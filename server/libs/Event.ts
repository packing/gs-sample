
class Listener {
    type: any;
    listener: Function;
    target: EventDispatcher;
    priority: number;
}

class EventDispatcher {
    private static __eventListener__ = {};
    static dispatchEvent(eventType: any, data: any): boolean {
        var l = EventDispatcher.__eventListener__[eventType] as Listener[];
        if (l == undefined || l.length == 0)
            return false;
        for(let e of l) {
            var r = e.listener(data);
            if(r != undefined && r) break;
        }
        return true;
    }

    constructor(){}

    public addEventListener(eventType: any, listener: Function, priority?: number) {
        var _prio = priority ? priority : 0;
        var l = EventDispatcher.__eventListener__[eventType] as Listener[];
        var le = new(Listener);
        le.type = eventType;
        le.listener = listener;
        le.target = this;
        le.priority = _prio;
        l == undefined ? l = [le] : l.push(le);
        l.sort((a:Listener, b:Listener) => { return a.priority > b.priority ? -1 : a.priority < b.priority? 1 : 0 });
        EventDispatcher.__eventListener__[eventType] = l;
    }
}

function Dispatcher(f: any) {
    new(f);
}
