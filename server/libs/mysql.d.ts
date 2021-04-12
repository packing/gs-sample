declare namespace mysql {
    declare class Query {
        sql: string
        action: number
        args: Array<any>
    }
    function query(sql: string, ...params: any): any;
    function exec(sql: string, ...params: any): number;
    function transaction(querys: Array<Query>): boolean;
}