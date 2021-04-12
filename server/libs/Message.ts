
const MessageKey = {
    Scheme      : 0x09,
    Type        : 0x10,
    Tag         : 0x11,
    SessionId   : 0x12,
    Sync        : 0x13,
    Body        : 0x14,
    ErrCode     : 0x15,
    Serial      : 0x16
}

const MessageTag = {
    Client: 0x03
}

const MessageSchemeC2S = 0x1;
const MessageSchemeC2C = 0x4;
const MessageSchemeS2C = 0x2;

var MessageMapping = {};

function MessageObject(type: number) {
    return function(f: Function) {
        MessageMapping[type] = f;
        f["eventType"] = "message_" + type;
        f["type"] = type;
        f.prototype.fromJsonObject = function(o: any): void {
            if (!this.referenceReversed) {
                console.log("MessageObject [" + this.constructor.name + "] 是否忘记使用了消息属性装饰器 MessageField?");
            } else {
                this.sessionId = o[MessageKey.SessionId];
                var body = o[MessageKey.Body];
                for (var k in this.referenceReversed) {
                    var pk = this.referenceReversed[k];
                    this[pk] = body[k];
                }
            }
        };
    
        f.prototype.toJsonObject = function(): any {
            var msg = {};
            msg[MessageKey.Scheme] = MessageSchemeS2C;
            msg[MessageKey.Type] = type;
            msg[MessageKey.Tag] = [MessageTag.Client];
            msg[MessageKey.SessionId] = this.sessionId;
            var o = {};
            if (!this.reference) {
                console.log("MessageObject [" + this.constructor.name + "] 是否忘记使用了消息属性装饰器 MessageField?");
            } else {
                for (var k in this.reference) {
                    var pk = this.reference[k];
                    o[pk] = this[k];
                }
            }

            msg[MessageKey.Body] = o;
            return msg;
        };
    }
}

function MessageField(index: number) {
    return function(target: any, propertyKey: string) {
        if(!target["reference"]) {
            target.reference = {};
            target.referenceReversed = {};
        }
        target.reference[propertyKey] = index;
        target.referenceReversed[index] = propertyKey;
    }
}

class Message {
    static eventType: string = "";
    static type: number = 0;
    errorCode : number = 0;
    sessionId : number = 0;
    public fromJsonObject(o:any): void {}
    public toJsonObject(): any {}
}

class MessageDispatcher {
    static dispatchMessage(sessionId: number, message: any): number {
        let mType = message[MessageKey.Type];
        let messageCls = MessageMapping[mType];
        if (messageCls == undefined) {
            console.log("消息类型 %d 貌似是一个无效的声明", mType);
            return 0;
        }
        let msg = new(messageCls);
        msg.fromJsonObject(message);
        //通过消息类型派发事件
        if(!EventDispatcher.dispatchEvent(mType, msg)) {
            console.log("消息类型 %d 没有对应的事件监听器", mType);
        }
        return 0;
    }
}