
const MessageKey = {
    Scheme  : 0x09,
    Type    : 0x10,
    Tag     : 0x11,
    Sync    : 0x13,
    Body    : 0x14,
    ErrCode : 0x15,
    Serial  : 0x16
}

const MessageTag = [0x1];
const MessageSchemeC2S = 0x1;
const MessageSchemeC2C = 0x4;

var MessageMapping = {};

function MessageObject(type: number) {
    return function(f: Function) {
        MessageMapping[type] = f;
        f["eventType"] = "message_" + type;
        f.prototype.type = type;
        f.prototype.fromJsonObject = function(o: any): void {
            if (!this.referenceReversed) {
                console.log("MessageObject [" + this.constructor.name + "] 是否忘记使用了消息属性装饰器 MessageField?");
            } else {
                for (var k in this.referenceReversed) {
                    var pk = this.referenceReversed[k];
                    this[pk] = o[k];
                }
            }
        };
    
        f.prototype.toJsonObject = function(): any {
            var o = {};
            if (!this.reference) {
                console.log("MessageObject [" + this.constructor.name + "] 是否忘记使用了消息属性装饰器 MessageField?");
            } else {
                for (var k in this.reference) {
                    var pk = this.reference[k];
                    o[pk] = this[k];
                }
            }
            return o;
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
    //type: number = 0;
    errorCode : number = 0;
    public fromJsonObject(o:any): void {

    }
    public toJsonObject(): any {

    }
}