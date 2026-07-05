const DB_NAME='roadbook-como-db-v3';
const DB_VERSION=1;
let dbPromise=null;
function openDB(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains('photos')){const s=db.createObjectStore('photos',{keyPath:'id'});s.createIndex('stepId','stepId',{unique:false});}if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv',{keyPath:'key'});if(!db.objectStoreNames.contains('steps'))db.createObjectStore('steps',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});return dbPromise;}
async function store(name,mode='readonly'){const db=await openDB();return db.transaction(name,mode).objectStore(name)}
async function idbGet(storeName,key){const s=await store(storeName);return new Promise((res,rej)=>{const r=s.get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);})}
async function idbPut(storeName,val){const s=await store(storeName,'readwrite');return new Promise((res,rej)=>{const r=s.put(val);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);})}
async function idbDelete(storeName,key){const s=await store(storeName,'readwrite');return new Promise((res,rej)=>{const r=s.delete(key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);})}
async function idbAll(storeName){const s=await store(storeName);return new Promise((res,rej)=>{const r=s.getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);})}
async function idbIndexAll(storeName,indexName,val){const s=await store(storeName);const idx=s.index(indexName);return new Promise((res,rej)=>{const r=idx.getAll(val);r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);})}
async function kvGet(key,fallback=null){const r=await idbGet('kv',key);return r?r.value:fallback}
async function kvSet(key,value){return idbPut('kv',{key,value})}
function blobToDataURL(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob)})}
