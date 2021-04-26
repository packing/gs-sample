declare namespace io {
    function read(filePath: string): string;
    function write(filePath: string, content: string): boolean;
    function exists(filePath: string): boolean;
    function unlink(filePath: string): boolean;
}