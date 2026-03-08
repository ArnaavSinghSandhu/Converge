function compareId(a,b){
    if(a.client !== b.client){
        return a.client < b.client ? -1 : 1
    }
    return a.clock - b.clock
}

function idKey(id){
    return `${id.client}:${id.clock}`
}
