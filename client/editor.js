const socket = io("http://localhost:3000")

const CLIENT_ID = "client-" + Math.random().toString(36).slice(2, 8)
const DOC_ID    = "doc-1"
const NAME      = prompt("Your name:") || CLIENT_ID
const COLOR     = randomColor()

const doc         = new CRDTDocument(CLIENT_ID)
let cursorAnchor  = null   
let remoteCursors = {}     
let lastSeenSeq   = 0
let isApplyingRemote = false  

const editor    = document.getElementById("editor")
const peersDiv  = document.getElementById("peers")
const statusDot = document.getElementById("status-dot")
const statusTxt = document.getElementById("status-text")

document.addEventListener('selectionchange', () => {
    const sel = window.getSelection()
    if (!sel.rangeCount) return
    
    const stack = new Error().stack
    const lines = stack ? stack.split('\n').slice(1).filter(l => l.trim()).join(' | ') : 'no stack'
    
    console.log(
        '%cSELECTIONCHANGE', 'color: orange; font-weight: bold',
        'offset:', sel.anchorOffset,
        '\nstack:', lines
    )
})
socket.on("connect",()=>{
    statusDot.className = "status-dot connected"
    statusTxt.textContent = "Connected"

    socket.emit("join",{
        docId: DOC_ID,
        lastSeenSeq : lastSeenSeq,
        name : NAME,
        color : COLOR
    })
})

socket.on("disconnect",() =>{
    statusDot.className = "status-dot disconnected"
    statusTxt.textContent = "Disconnected"
})

socket.on("init",({missing}) => {
    for(const row of missing){
        doc.applyRemote(row.payload)
        if(row.seqNum > lastSeenSeq) lastSeenSeq = row.seqNum
    }
    render()
})

socket.on("op",({op,seqNum,cursorUpdate})=>{
    const savedAnchor = cursorAnchor

    isApplyingRemote = true
    doc.applyRemote(op)

    isApplyingRemote = false

    if(seqNum > lastSeenSeq) lastSeenSeq = seqNum

    if(cursorUpdate){
        remoteCursors[cursorUpdate.clientId] = cursorUpdate
    }
    render()

    if(savedAnchor){
        const newIndex = doc.getIndexOfItem(savedAnchor)
        setCursorToIndex(newIndex)
    }
})

socket.on("cursor", ({clientId,anchorId,name,color})=>{
    remoteCursors[clientId] = {anchorId,name,color}
    renderRemoteCursors()
});

socket.on("presence", ({peers}) => {
    renderPeers(peers)
})

editor.addEventListener("keydown", (e) => {

    const sel = window.getSelection()
    const offset = getEditorOffset(sel.anchorNode, sel.anchorOffset)

    const leftItem  = doc.getItemAtIndex(offset - 1) || doc.head
    const rightItem = leftItem.next || doc.tail

    if (e.key === "Enter") {
        e.preventDefault()

        const op = doc.localInsert(leftItem, rightItem, "\n")

        cursorAnchor = idKey(op.id)

        emitOp(op)
        render()
        broadcastCursor()
        return
    }

    if (e.key.length === 1) {
        e.preventDefault()

        const op = doc.localInsert(leftItem, rightItem, e.key)

        cursorAnchor = idKey(op.id)

        emitOp(op)
        render()
        broadcastCursor()
    }
})

editor.addEventListener("input",(e)=>{
    if(isApplyingRemote) return
    const sel = window.getSelection()
    const offset = getEditorOffset(sel.anchorNode, sel.anchorOffset)

    console.log("--- INPUT ---")
    console.log("inputType:", e.inputType)
    console.log("offset:", offset)


    if(
        e.inputType === "deleteContentBackward" || 
        e.inputType === "deleteContentForward"
    ){
        const deleteIndex = e.inputType === "deleteContentBackward" ? offset : offset + 1

        const target = doc.getItemAtIndex(deleteIndex)
        if(target && target !== doc.head && target !== doc.tail){
            const op = doc.localDelete(target)
            const leftItem = doc.getItemsById.get(idKey(target.left))

            if (leftItem && !leftItem.deleted) {
                cursorAnchor = idKey(leftItem.id)
            }

            emitOp(op)
        }
    }
    render()
    broadcastCursor()

})

editor.addEventListener("keyup", broadcastCursor)
editor.addEventListener("mouseup", broadcastCursor)
editor.addEventListener("touchend", broadcastCursor)

function render() {
  const savedAnchor = cursorAnchor
  const savedOffset = (() => {
    const sel = window.getSelection()
    if (!sel.rangeCount) return 0
    return getEditorOffset(sel.anchorNode, sel.anchorOffset)
  })()

  const text = doc.getText()
  editor.textContent = text

  if (savedAnchor) {
    const index = doc.getIndexOfItem(savedAnchor)
    if (index !== -1) {
      const pos = Math.max(0, index + 1)
      setCursorToIndex(pos)
    } else {
      setCursorToIndex(savedOffset)
    }
  } else {
    setCursorToIndex(savedOffset)
  }

  renderRemoteCursors()
}

function renderRemoteCursors() {
  document.querySelectorAll(".remote-cursor").forEach(el => el.remove())

  for (const [clientId, cursor] of Object.entries(remoteCursors)) {
    if (!cursor.anchorId) continue

    const index = doc.getIndexOfItem(cursor.anchorId)
    const coords = getCoordinatesAtIndex(index)
    if (!coords) continue

    const line = document.createElement("div")
    line.className = "remote-cursor"
    line.style.left   = coords.left + "px"
    line.style.top    = coords.top + "px"
    line.style.height = coords.height + "px"
    line.style.background = cursor.color

    const label = document.createElement("div")
    label.className = "remote-cursor-label"
    label.textContent = cursor.name
    label.style.background = cursor.color
    line.appendChild(label)

    editor.parentElement.appendChild(line)
  }
}

function renderPeers(peers) {
  peersDiv.innerHTML = ""
  for (const peer of peers) {
    const avatar = document.createElement("div")
    avatar.className = "peer-avatar"
    avatar.style.background = peer.color
    avatar.textContent = peer.name[0].toUpperCase()
    avatar.title = peer.name
    peersDiv.appendChild(avatar)
  }
}


function setCursorToIndex(index){
    const textNode = editor.firstChild
    if (!textNode) { console.warn("setCursorToIndex: no textNode!"); return }

    const range = document.createRange()
    const sel   = window.getSelection()
    const safeIndex = Math.min(index, textNode.length)

    console.log("setCursorToIndex called with:", index, "→ clamped to:", safeIndex)

    range.setStart(textNode, safeIndex)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)

        console.log("sel after addRange:", window.getSelection().anchorOffset)


}

function getEditorOffset(node,offset){
    const walker = document.createTreeWalker(editor,NodeFilter.SHOW_TEXT,null)
    let total = 0
    let curr = walker.nextNode()

    while(curr){
        if(curr === node) return total + offset
        total += curr.textContent.length
        curr = walker.nextNode();
    }

    return total;
}

function getCoordinatesAtIndex(index) {
  const textNode = editor.firstChild
  if (!textNode) return null

  const range = document.createRange()
  range.setStart(textNode, Math.min(index, textNode.length))
  range.collapse(true)

  const rect        = range.getBoundingClientRect()
  const editorRect  = editor.parentElement.getBoundingClientRect()

  return {
    left:   rect.left - editorRect.left,
    top:    rect.top  - editorRect.top,
    height: rect.height || 16
  }
}

function broadcastCursor() {
  const sel = window.getSelection()
  if (!sel.rangeCount) return

  const offset = getEditorOffset(sel.anchorNode, sel.anchorOffset)
  const item   = doc.getItemAtIndex(offset - 1)
  cursorAnchor = item ? idKey(item.id) : null

  socket.emit("cursor", {
    docId:    DOC_ID,
    anchorId: cursorAnchor,
    name:     NAME,
    color:    COLOR
  })
}

function emitOp(op) {
  socket.emit("op", { docId: DOC_ID, op })
}

function idKey(id) {
  return `${id.client}:${id.clock}`
}

function randomColor() {
  const colors = [
    "#1a73e8", "#e8710a", "#188038",
    "#a142f4", "#d93025", "#007b83"
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}