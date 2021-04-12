declare namespace net {
    declare interface Message {
        type: number
        code: number
    }

    function reply(msg: any): number;
    function deliver(msg: any): number;
}