declare namespace sync {
    function init(key?: number): boolean;
    function dispose(key?: number): boolean;
    function lock(key?: number): number;
    function unlock(sid?, key?: number): number;
}