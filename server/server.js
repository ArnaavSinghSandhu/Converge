const Fastify = require("fastify")
const {Server} = require("socket.io")
const CRDTDocument = require("../crdt/document");
const { saveDocToRedis, loadDocFromRedis } = require("../src/store/redis")
const { saveOp, getOpsSince, saveSnapShot, getLatestSnapshot } = require("../src/store/postgres")
const app = Fastify();

const io = new Server(app.server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

const docs = new Map()
const opCounts = new Map()
const peers = new Map()


async function getDoc(docId){
    if(docs.has(docId)) return docs.get(docId);
    
    const cached = await loadDocFromRedis(docId);
    if(cached){
        const doc = CRDTDocument.fromItems("server", cached.items)
        
        const missed = await getOpsSince(docId, cached.lastSeq)
        for (const row of missed) {
            doc.applyRemote(row.payload)
        }

        const lastSeq = missed.length > 0 ? missed[missed.length - 1].seqNum: cached.lastSeq;

        saveDocToRedis(docId, doc, lastSeq)

        docs.set(docId,doc)
        return doc
    }
    const snapshot = await getLatestSnapshot(docId)
    const lastSeq  = snapshot?.lastSeq ?? 0
    const doc      = snapshot
        ? CRDTDocument.fromItems("server", snapshot.state)
        : new CRDTDocument("server")

    const missed = await getOpsSince(docId, lastSeq)
    for (const row of missed) doc.applyRemote(row.payload)

    docs.set(docId, doc)
    return doc
}


io.on("connection",(socket)=>{
    socket.on("join",async ({docId,lastSeenSeq,name,color}) => {
        socket.join(docId);
        socket.data = { docId, clientId: socket.id, name, color}

        if(!peers.has(docId)) peers.set(docId,new Map())
        peers.get(docId).set(socket.id, { name, color})
        
        io.to(docId).emit("presence",{
            peers:[...peers.get(docId).values()]
        })
        const doc = await getDoc(docId)
        const missing = await getOpsSince(docId, lastSeenSeq ?? 0)
        socket.emit("init", {
            missing
        })
    })

    socket.on("cursor", ({ docId, anchorId, name , color})=>{
        socket.to(docId).emit("cursor", {
        clientId: socket.id,
        anchorId,
        name,
        color
        })
    })

    socket.on("disconnect", () => {
    const { docId } = socket.data || {}
        if (docId && peers.has(docId)) {
        peers.get(docId).delete(socket.id)
        io.to(docId).emit("presence", {
            peers: [...peers.get(docId).values()]
        })
        }
    })
    socket.on("op",async ({docId, op})=>{
        const doc = await getDoc(docId)
        doc.applyRemote(op)

        const saved = await saveOp(docId,op.id?.client, op);

        saveDocToRedis(docId, doc, saved.seqNum);

        socket.to(docId).emit("op",{ op, seqNum: saved.seqNum })
    })
})
app.listen({ port: 3000 }, () => {
    console.log("Server running on port 3000")
})
