///<reference path="./libs/Event.ts" />
///<reference path="./messages/SysMessage.ts" />

@Dispatcher
class Sys extends EventDispatcher {
    constructor() {
        super();
        //console.log("Sys instanced");
        this.addEventListener(HeartMessage.type, this.onHeart);
    }

    onHeart(heart: HeartMessage): boolean {
        var d = (new Date()).getTime();
        //var rows = mysql.query("select * from sessions where playerid=?", 1)
        /*
        redis.cmd("SET","testm1", [1,2,3]);
        var r = redis.cmd("GET", "testm1");
        redis.cmd("SET","testm2", {a:22,b:343});
        r = redis.cmd("GET", "testm2");
        redis.cmd("SET","testm3", "1sadasddaskdsjakldahsdhlkhkl121121");
        r = redis.cmd("GET", "testm3");
        */
        //console.log("\n");
        //console.log("执行耗时 " + ((new Date()).getTime() - d) + " ms");
        //console.log("\n");
        //sync.lock();
        net.reply(heart.toJsonObject());
        //sync.unlock();
        return true;
    }
}
