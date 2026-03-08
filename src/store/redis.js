const Redis = require("ioredis");

const redis = new Redis()

const DOC_STATE_KEY = (docId) => `doc:${docId}:state`
const DOC_SEQ_KEY = (docId) => `doc:${docId}:lastSeq`

async function saveDocToRedis(docId, doc, lastSeq){
    const items = []
    let curr = doc.head.next
    while(curr !== doc.tail){
        items.push({
            id:      curr.id,
            left:    curr.left,
            right:   curr.right,
            content: curr.content,
            deleted: curr.deleted,
        })
        curr = curr.next
    }
    await redis.set(DOC_STATE_KEY(docId),JSON.stringify(items))
    await redis.set(DOC_SEQ_KEY(docId),lastSeq)
}

async function loadDocFromRedis(docId){
    const raw = await redis.get(DOC_STATE_KEY(docId));
    const lastSeq = await redis.get(DOC_SEQ_KEY(docId));

    if(!raw) return null;

    return{
        items: JSON.parse(raw),
        lastSeq: parseInt(lastSeq) || 0
    }
}

module.exports = { saveDocToRedis, loadDocFromRedis};

