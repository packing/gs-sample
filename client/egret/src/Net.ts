
class NetEvent extends egret.Event {
    public static HEART = "heart";
}

class Net extends egret.EventDispatcher {
    private socket = new egret.WebSocket();
    private url: string = "";
    public constructor() {
        super();
        
        this.socket.type = egret.WebSocket.TYPE_BINARY;
        this.socket.addEventListener(egret.ProgressEvent.SOCKET_DATA, 	this.onReceiveMessage, this);
        this.socket.addEventListener(egret.Event.CONNECT, this.onSocketOpen, this);
        this.socket.addEventListener(egret.Event.CLOSE, this.onSocketClose, this);
        this.socket.addEventListener(egret.IOErrorEvent.IO_ERROR, this.onSocketError, this);
    }

    public connect(url: string): void {
        this.url = url;
        this.socket.connectByUrl(url);
    }

    public close(): void {
        this.socket.close();
    }

    public isConnected(): boolean {
        return this.socket.connected;
    }

    public sendMessage(msg: Message, scheme?: number, sync?: boolean) {
        var o = {};
        o[MessageKey.Scheme] = scheme ? scheme : MessageSchemeC2S;
        o[MessageKey.Tag] = MessageTag;
        o[MessageKey.Sync] = sync ? sync : false;
        o[MessageKey.Type] = Object.getPrototypeOf(msg)["type"];
        o[MessageKey.Body] = msg.toJsonObject();

        let b = NB.IntermediateV2Codec.encode(o);
        b["arrayBuffer"]().then((ab) => {
            console.log("发送消息 =>", o);
            const byte: egret.ByteArray = new egret.ByteArray(ab);
            console.log("发送消息 =>", byte.bytes);
            console.log("长度 ==", byte.length);
            this.socket.writeBytes(byte);
        });
    }
    
    private onReceiveMessage(e: egret.Event): void {
        const byte: egret.ByteArray = new egret.ByteArray();
        this.socket.readBytes(byte);
        let o = NB.IntermediateV2Codec.decode(byte.buffer);
        console.log("收到消息 <=");
        console.log("长度 ==", byte.length);
        console.log(o);

        var msgType = o[MessageKey.Type];
        if (msgType == undefined) {
            return;
        }
        var msgObject = MessageMapping[msgType];
        if (msgObject == undefined) {
            return;
        }

        var msg = new msgObject();
        var msgBody = o[MessageKey.Body];
        if (msgBody != undefined)
            msg.fromJsonObject(msgBody);
        var msgCode = o[MessageKey.ErrCode];
        if (msgCode != undefined)
            msg.errorCode = msgCode;

        this.dispatchEventWith(msgObject["eventType"], true, msg, false);
    }
    
    private onSocketOpen(): void {
        console.log("连接服务器 " + this.url + " 成功");
    }
    
    private onSocketClose(): void {
        console.log("已经从 " + this.url + " 断开连接");
    }
    
    private onSocketError(): void {
        console.log("socket操作出错");
    }
    
}

let GlobalNet = new Net();