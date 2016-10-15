import {defer} from '../lib/jslib/es6/dist/es6/src/utils-es6';
import {config} from './config';
import {isNumber} from '../lib/jslib/es5/dist/utils-es5';

declare function $(s: string): HTMLCollection;

namespace ItemKeys {
  export const lastid = 'lastid';
  export const building_task_list = 'building_task_list';
  export const farm_info = 'farm_info';
  export const production_info = 'production_info';
  export const hero_advance_info = 'hero_advance_info';
  // export const quest_info = 'quest_info';
}

/* time to refetch the Item from webpage into localStorage */
const default_expire_period = 1000 * 30;

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
  console.log('store', key, value);
  localStorage[key] = JSON.stringify(value);
}

function newId(): number {
  let last = getOrElse(ItemKeys.lastid, id(0));
  store(ItemKeys.lastid, last + 1);
  return last + 1;
}

function last<A>(xs: A[]): A {
  return xs[xs.length - 1];
}

function groupBy<A>(f: (a: A)=>number, as: A[]): {[id: number]: A[]} {
  let res: {[id: number]: A[]} = {};
  as.forEach(a=> {
    let i = f(a);
    if (res[i]) {
      res[i].push(a);
    } else {
      res[i] = [a];
    }
  });
  return res;
}

function obj_to_array(o: any): Array<[string,any]> {
  return Object.keys(o)
    .map(k=> {
      let res: [string,any] = [k, o[k]];
      return res;
    });
}

function str_to_int(s: string): number {
  return +s.split('').filter(x=>
    x == '0'
    || x == '1'
    || x == '2'
    || x == '3'
    || x == '4'
    || x == '5'
    || x == '6'
    || x == '7'
    || x == '8'
    || x == '9'
    || x == ','
  ).reduce((acc, c)=> {
    if (c == ',')
      return acc;
    else
      return acc + c;
  });
}

class Item<A> {
  name: string;
  id: number;
  createTime: number;
  data: A;
  expire_period: number;
  expire_date: number;

  constructor(data?: any) {
    Object.assign(this, data);
    if (notDefined(this.id)) {
      this.id = newId();
    }
    if (notDefined(this.createTime)) {
      this.createTime = Date.now();
    }
    if (notDefined(this.expire_period)) {
      this.expire_period = default_expire_period;
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
    let ori$ = window[<number><any>'$'];
    s.onload = ()=> {
      window[<number><any>'$'] = ori$;
      main();
    };
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
  buildingName: string;
  buildingLevel: number;
  buildDuration: number;
  finishTime: number;
}
function find_building_task_list(cb: Function) {
  const $ = jQuery;
  console.log('find building task list');
  if (isInPage('dorf1.php', 'dorf2.php')) {
    let res = new Item<BuildingTask[]>();
    res.data = $('.buildingList')
      .find('li')
      .map((i, e)=> {
        let res = new BuildingTask();
        res.buildingName = $(e).find('.name').text().split('\t').filter(x=>x.length > 0)[1];
        res.buildingLevel = $(e).find('.lvl').text().split(' ').filter(isNumber).map(x=>+x)[0];
        res.buildDuration = +$(e).find('span.timer').attr('value');
        res.finishTime = Date.now() + res.buildDuration;
        // console.log('building task', res);
        return res;
      }).toArray();
    if (res.data.length > 0) {
      res.expire_period = res.data.map(x=>x.buildDuration).reduce((acc, c)=>Math.max(acc, c));
      res.expire_date = res.data.map(x=>x.finishTime).reduce((acc, c)=>Math.max(acc, c));
    }
    // console.log('building task list', res.data);
    store(ItemKeys.building_task_list, res);
    cb();
  } else {
    location.replace('dorf1.php')
  }
}
class Farm {
  id: number;
  name: string;
  level: number;
  /* 1..4 */
  farm_type: number;
  not_now: boolean;
  under_construct: boolean;

  pathname() {
    return 'build.php?id=' + this.id;
  }
}

function find_farm_info(cb: Function) {
  const $ = jQuery;
  if (isInPage('dorf1.php')) {
    let res = new Item<Farm[]>();
    res.data = jQuery('map').find('area')
      .filter((i, e)=>$(e).attr('href').includes('build'))
      .map((i, e)=> {
        let xs = $(e).attr('alt').split(' ');
        let res = new Farm();
        res.name = xs[0];
        res.level = +xs[2];
        return res;
      })
      .toArray();
    jQuery('#village_map').find('.level')
      .each((i, e)=> {
        let $e = $(e);
        var classStr = $e.attr('class');
        let level = last(classStr.split('level'));
        if (+level != res.data[i].level) {
          throw new Error('farm not matching');
        }
        res.data[i].not_now = classStr.includes('notNow');
        res.data[i].under_construct = classStr.includes('underConstruction');
        res.data[i].farm_type = classStr.split(' ').filter(x=>x.includes('gid')).map(x=>+x.replace('gid', ''))[0];
      });
    console.log('farms', res.data);
    store(ItemKeys.farm_info, res);
    cb();
  } else {
    location.replace('dorf1.php');
  }
}
class ProductionInfo {
  warehouse_size: number;
  granary_size: number;
  produce_rate: number[];
  amount: number[];
  storage_capacity: number[];
  time_to_full: number[];
}
function find_production_info(cb: Function) {
  console.log('find production info');
  const $ = jQuery;
  let res = new ProductionInfo();
  if (isInPage('dorf1.php')) {
    res.produce_rate = jQuery('table#production').find('td.num')
      .map((i, e)=> {
        return str_to_int($(e).text());
      })
      .toArray();
    let stocks = $('.stock')
      .map((i, e)=>str_to_int($(e).text()))
      .toArray();
    res.warehouse_size = stocks[0];
    res.granary_size = stocks[1];
    res.storage_capacity = [
      res.warehouse_size
      , res.warehouse_size
      , res.warehouse_size
      , res.granary_size
    ];
    res.amount = jQuery('#stockBar').find('.stockBarButton').find('span')
      .map((i, e)=>str_to_int($(e).text()))
      .toArray();
    res.time_to_full = res.storage_capacity.map((cap, i)=> {
      return (cap - res.amount[i]) / (res.produce_rate[i] ) * 3600 * 1000;
    });
    let item = new Item<ProductionInfo>();
    item.data = res;
    store(ItemKeys.production_info, item);
    cb();
  } else {
    location.replace('dorf1.php');
  }
}

namespace HeroStatus {
  export const in_home = 'in_home';
}
class HeroAdvanceInfo {
  numberOfAdvance: number;
  heroStatus: string;
}
function find_hero_advance_info(cb: Function) {
  const $ = jQuery;
  console.log('find hero advance info');
  let res = new Item<HeroAdvanceInfo>();
  res.data = new HeroAdvanceInfo();
  /* find status */
  var $heroStatusMessage = $('.heroStatusMessage');
  var statusClass = $heroStatusMessage
    .find('img')
    .attr('class');
  switch (statusClass) {
    case 'heroStatus100':
      res.data.heroStatus = HeroStatus.in_home;
      break;
    default:
      throw new Error('not identifiable hero status <' + statusClass + '> : ' + $heroStatusMessage.text())
  }
  /* find number of advance */
  res.data.numberOfAdvance = $('.adventureWhite')
    .find('.speechBubbleContent')
    .val();
  console.log('hero advance info', res.data);
  store(ItemKeys.hero_advance_info, res);
  cb();
}

function find_quest_info(cb: Function) {
  const $ = jQuery;
  console.log('find quest info');
  let e = $('.questButtonOverviewAchievements');
  console.log('quest button', e);
  e.click();
}

function main() {
  login() && setTimeout(findTask);
}

function login(): boolean {
  const $ = jQuery;
  let res = $('.loginTable');
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
    execute_build_task();
  } else {
    let name: string = xs[0];
    console.log('found task', name);
    switch (name) {
      case ItemKeys.building_task_list:
        return find_building_task_list(findTask);
      case ItemKeys.farm_info:
        return find_farm_info(findTask);
      case ItemKeys.production_info:
        return find_production_info(findTask);
      case ItemKeys.hero_advance_info:
        return find_hero_advance_info(findTask);
      // case ItemKeys.quest_info:
      //   return find_quest_info(findTask);
      default:
        console.error('not impl', name);
    }
  }
}

function execute_build_task() {
  const $ = jQuery;
  console.log('execute build task');
  let buildingTasks: BuildingTask[] = getOrElse(ItemKeys.building_task_list, ()=> {
    find_building_task_list(execute_build_task);
    throw new Error('building task list not ready');
  }).data;
  let farms: Farm[] = getOrElse<Farm[]>(ItemKeys.farm_info, ()=> {
    find_farm_info(execute_build_task);
    return [];
  }).data.filter((farm: Farm)=>!farm.not_now);
  let production_info: ProductionInfo = getOrElse(ItemKeys.production_info, ()=> {
    find_production_info(execute_build_task);
    throw new Error('production info not ready');
  }).data;
  let max_time = production_info.time_to_full.reduce((acc, c)=>Math.max(acc, c));
  let farmss: {[idx: number]: Farm[]} = groupBy(farm=>farm.farm_type, farms.filter(x=>!x.not_now));
  let farm = obj_to_array(farmss)
    .map((e: [string,Farm[]])=>[+e[0], e[1]])
    .map((e: [number,Farm[]])=> {
      let farms: Farm[] = e[1];
      return farms.reduce((acc, c)=> {
        if (acc.level < c.level)
          return acc;
        else
          return c;
      })
    })
    .reduce((acc, c)=> {
      console.log('compare', acc, c);
      if (production_info.time_to_full[acc.farm_type] < production_info.time_to_full[c.farm_type]) {
        console.log('chosen', c);
        return c;
      }
      else {
        console.log('chosen', acc);
        return acc;
      }
    });
  Object.setPrototypeOf(farm, Farm.prototype);
  console.log('selected farm', farm);
}
