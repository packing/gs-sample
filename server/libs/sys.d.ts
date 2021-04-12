declare namespace sys {
    function version(): string;
    function encode(v: any): string;
    function decode(s: string): any;
}