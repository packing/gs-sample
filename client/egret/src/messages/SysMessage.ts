
@MessageObject(0x02)
class HeartMessage extends Message {
    @MessageField(0x18)
    vt:number;
}

@MessageObject(0x01)
class DeliverMessage extends Message {
    @MessageField(0x17)
    id:number;
}
