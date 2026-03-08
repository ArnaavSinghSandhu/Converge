const {PrismaClient} = require("@prisma/client")

const prisma = new PrismaClient()

async function saveOp(docId, clientId, op){
    return prisma.op.create({
        data:{
            docId,
            clientId,
            type : op.type,
            payload: op
        }
    })
};


async function getOpsSince(docId, lastSeq){
    const rows = await prisma.op.findMany({
        where: {docId, seqNum: {gt: lastSeq}},
        orderBy: {seqNum: "asc"},
    })

    return rows;
}

async function saveSnapShot(docId, doc, lastSeq){
    const items = []
    let curr = doc.head.next
    while(curr !== doc.tail){
        items.push({
            id:      curr.id,
            left:    curr.left,
            right:   curr.right,
            content: curr.content,
            deleted: curr.deleted
        })
        curr = curr.next
    }

    return prisma.snapShot.create({
        data:{docId,state:items,lastSeq}
    })
}

async function getLatestSnapshot(docId){
    const rows = await prisma.snapShot.findFirst({
        where: {docId},
        orderBy: {createdAt:"desc"},
    })
    return rows;
}

module.exports = {
    saveOp,
    getOpsSince,
    saveSnapShot,
    getLatestSnapshot
}