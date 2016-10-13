import {defer} from '../lib/jslib/es6/dist/es6/src/utils-es6';
import {log} from "typings/dist/support/cli";
import {config} from "./config";
const expire_period = 10000;
/* 10 second */
namespace ItemKeys {
  export const lastid = 'lastid';
  export const building_task_list = 'building_task_list';
}
function isDefined(o: any) {
  return !(typeof o === 'undefined' || o == null);
}
function notDefined(o: any) {
  return (typeof o === 'undefined' || o == null);
}
function id<A>(a: A): ()=>A {
  return ()=>a;
}
function has(key: string) {
  return isDefined(localStorage[key]);
}
function getOrElse<A>(key: string, fallback: ()=>A) {
  if (has(key))
    return JSON.parse(localStorage[key]);
  else
    return fallback();
}
function store(key: string, value: any) {
  localStorage[key] = JSON.stringify(value);
}
function newId(): number {
  let last = getOrElse(ItemKeys.lastid, id(0));
  store(ItemKeys.lastid, last + 1);
  return last + 1;
}
class Item<A> {
  name: string;
  id: number;
  createTime: number;
  data: A;
  expire_period = expire_period;
  expire_date: number;

  constructor(data?: any) {
    Object.assign(this, data);
    if (notDefined(this.id)) {
      this.id = newId();
    }
    if (notDefined(this.createTime)) {
      this.createTime = Date.now();
    }
    if (notDefined(this.expire_date)) {
      this.expire_date = this.createTime + this.expire_period;
    }
  }

  store() {
    store(this.name, this)
  }

  static load<A>(name: string, prototype: any): Item<A> {
    let x = getOrElse(name, ()=> {
      throw new Error('Item ' + name + ' not found')
    });
    Object.setPrototypeOf(x, prototype);
    return x;
  }
}
function init() {
  console.log('begin init');
  if (typeof jQuery === 'undefined') {
    let s = document.createElement('script');
    s.src = 'https://ajax.googleapis.com/ajax/libs/jquery/3.1.0/jquery.min.js';
    s.onload = main;
    document.head.appendChild(s);
  } else {
    setTimeout(main);
  }
  console.log('end init');
}
init();

function isInPage(...filenames: string[]) {
  return filenames.some(filename=>location.pathname == '/' + filename);
}
class BuildingTask {
}
function find_building_task_list(cb: Function) {
  console.log('find building task list');
  if (isInPage('dorf1.php', 'dorf2.php')) {
    let res = new Item<BuildingTask[]>();
    res.data = [];
    store(ItemKeys.building_task_list, res);
    cb();
  } else {
    location.replace('dorf1.php')
  }
}

function main() {
  login() && setTimeout(findTask);
}

function login(): boolean {
  let res = $('.loginBox');
  console.log('check login', res.length);
  if (res.length == 0) {
    return true;
  }
  res.find('.account').find('input').val(config.username);
  res.find('.pass').find('input').val(config.password);
  res.find('[type=submit]').click();
  return false;
}

function findTask() {
  console.log('find task');
  let xs: string[] = Object.keys(ItemKeys)
      .filter(x=>x != ItemKeys.lastid)
      .filter(x=> {
        return !has(x) || (
            Item.load(x, Item.prototype).expire_date < Date.now()
          );
      })
    ;
  if (xs.length == 0) {
    console.log('no task');
  } else {
    let name: string = xs[0];
    switch (name) {
      case ItemKeys.building_task_list:
        find_building_task_list(findTask);
        return;
      default:
        console.error('not impl', name);
    }
  }
}
