import test from 'node:test';import assert from 'node:assert/strict';
import {requireOperator,validateReception} from '../server/operator.mjs';
const member={role:'reception',active:true,tenantId:'piloto',deviceAccess:true},token={firebase:{sign_in_provider:'anonymous'}};
test('solo equipo habilitado entra en recepción',()=>{assert.equal(requireOperator(member,token),member);for(const m of [null,{...member,active:false},{...member,deviceAccess:false},{...member,role:'owner'},{...member,tenantId:'../otro'}])assert.throws(()=>requireOperator(m,token));});
const before={schema:1,clients:[],appointments:[],movements:[],stockLedger:[],barbers:[],services:[],settlements:[],productRates:{},commissionRules:[]};
test('recepción puede registrar clientes pero no modificar configuración',()=>{validateReception(before,{...before,clients:[{id:1,name:'Ana'}]});for(const k of ['barbers','services','settlements','productRates','commissionRules'])assert.throws(()=>validateReception(before,{...before,[k]:[1]}));assert.throws(()=>validateReception(null,before));});
test('recepción solo descuenta stock asociado a venta nueva',()=>{assert.throws(()=>validateReception(before,{...before,stockLedger:[{id:1,product:1,delta:5}]}));validateReception(before,{...before,movements:[{id:2,kind:'sale',product:1,quantity:1}],stockLedger:[{id:1,saleId:2,product:1,delta:-1}]});});
test('recepción no puede rebajar precio de cita existente',()=>{const a={...before,appointments:[{id:1,price:40}]};assert.throws(()=>validateReception(a,{...a,appointments:[{id:1,price:1}]}));});
