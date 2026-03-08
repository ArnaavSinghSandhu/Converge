const Item = require("./item");

const { compareId, idKey} = require("./utils.js");

class CRDTDocument{
    constructor(clientID){
        this.id = clientID;
        this.clock = 0
        this.getItemsById = new Map();
        this.head = new Item({client:"HEAD",clock:0},null,null,"");
        this.tail = new Item({client:"TAIL",clock:0},null,null,"")
        this.cursorAnchor = null;
        this.head.next = this.tail;
        this.tail.prev = this.head;
    }   

    generateId(){
        return{
            client:this.id,
            clock: ++this.clock
        }
    }

    localInsert(leftitem,rightItem,char){
       
        const id = this.generateId();
        const item = new Item(id,leftitem.id,rightItem.id,char)

        this.integrate(item);
        return{
            type:"insert",
            id,
            left:leftitem.id,
            right:rightItem.id,
            content:char,
        }

    }

    localDelete(item){
        item.deleted = true
        return{
            type:"delete",
            id:item.id
        }
    }

    applyRemote(op){
        if(op.type === "insert"){
            const item = new Item(
                op.id,
                op.left,
                op.right,
                op.content
            )

            this.integrate(item);
        }
        if(op.type === "delete"){
            const item = this.getItemsById.get(idKey(op.id))
            if(item) item.deleted = true
        }
    }
    integrate(item){
        const left = this.getItemsById.get(idKey(item.left)) || this.head
        const right = this.getItemsById.get(idKey(item.right)) || this.tail

        let curr = left.next
        while(curr !== right){
            const currLeft = this.getItemsById.get(idKey(curr.left)) || this.head;
            const itemLeft = left;

            if(currLeft !== itemLeft){
                const currLeftPos = this._getPosition(currLeft);
                const itemLeftPos = this._getPosition(itemLeft);

                if(currLeftPos > itemLeftPos) break
                if(currLeftPos < itemLeftPos){
                    curr = curr.next
                    continue
                }
                
            }
            if(item.id.client < curr.id.client) break
            curr = curr.next;
        }
        const prev = curr.prev;
        item.prev = prev
        item.next = curr
        prev.next = item
        curr.prev = item

        this.getItemsById.set(idKey(item.id),item);

    }
    getText(){
        let result = ""

        let curr = this.head.next

        while(curr !== this.tail){
            if(!curr.deleted){
                result += curr.content
            }

            curr = curr.next
        }
        return result
    }
    _getPosition(item) {
        let pos = 0
        let curr = this.head
        while (curr !== item && curr !== null) {
            pos++
            curr = curr.next
        }
        return pos
    }
    getItemAtIndex(index){
        if (index < 0) return null

        let curr = this.head.next
        let pos = 0

        while(curr !== this.tail){

            if(!curr.deleted){
                if(pos === index) return curr;
                pos++;
            }
            curr = curr.next;
        }
        return null;
    }
    getIndexOfItem(targetId){
        if (!targetId) return -1

        const key = typeof targetId === "string" ? targetId : idKey(targetId)
        let item = this.getItemsById.get(key)

        while (item && item.deleted) {
            item = this.getItemsById.get(idKey(item.left))
        }

        if (!item || item === this.head) return -1

        let curr = this.head.next
        let pos = 0

        while (curr !== this.tail) {
            if (!curr.deleted) {
                if (curr === item) return pos
                pos++
            }
            curr = curr.next
        }

        return -1
    }
    applyRemoteAndRemapCursor(op, cursorAnchor) {
        this.applyRemote(op)
        
        return this.getIndexOfItem(cursorAnchor)
    }

    static fromItems(clientId, items) {
        const doc = new CRDTDocument(clientId)

        for (const raw of items) {
            const item = new Item(raw.id, raw.left, raw.right, raw.content)
            item.deleted = raw.deleted
            doc.getItemsById.set(idKey(raw.id), item)
        }

        
        let prev = doc.head
        for (const raw of items) {
            const item = doc.getItemsById.get(idKey(raw.id))
            prev.next  = item
            item.prev  = prev
            item.next  = doc.tail
            doc.tail.prev = item
            prev = item
        }

        return doc
    }
}

module.exports = CRDTDocument