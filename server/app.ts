
function __init__(): number {
    console.log("脚本引擎环境初始化成功,当前版本 " + sys.version());

    let c = io.read("test.json");
    console.log(c);
    let objectC = JSON.parse(c);
    console.log(objectC);

    return 0
}

function __main__() {
    var e = new EventDispatcher();
}

function __enter__(sessionid: number, addr: string): number {
    //console.log(sessionid + "[" + addr + "] enter");
    return 0;
}

function __leave__(sessionid: number, addr: string): number {
    //console.log(sessionid + "[" + addr + "] leave");
    return 0;
}

function __message__(sessionid: number, message: any): number {
    //console.log(sessionid + " message received");
    //console.log(JSON.stringify(message));
    return MessageDispatcher.dispatchMessage(sessionid, message);
}