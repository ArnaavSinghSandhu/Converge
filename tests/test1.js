const CRDTDocument = require("../crdt/document.js")
const { idKey } = require("../crdt/utils")

const docA = new CRDTDocument("A")
const docB = new CRDTDocument("B")

// Both insert at same position simultaneously
const opA = docA.localInsert(docA.head, docA.tail, "X")
const opB = docB.localInsert(docB.head, docB.tail, "Y")

// Cross apply
docA.applyRemote(opB)
docB.applyRemote(opA)

const textA = docA.getText()
const textB = docB.getText()

console.log("A:", textA)
console.log("B:", textB)
console.log("Converged:", textA === textB)