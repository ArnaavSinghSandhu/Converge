class Item{
    constructor(id,left, right, content){
        this.id = id;
        this.left = left;
        this.right = right;
        this.content = content;

        this.deleted = false;
        this.prev = null;
        this.next = null;
    }
}
