declare namespace redis {
    function open(): boolean;
    function close(): boolean;
    function cmd(cmd: string, ...params: any): any;
    function todo(cmd: string, ...params: any): any;
    function send(cmd: string, ...params: any): boolean;
    function flush(): boolean;
    function receive(): any;
}