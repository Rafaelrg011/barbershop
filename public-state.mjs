// Acceso público solicitado: permite gestionar la barbería piloto sin credenciales.
import {handleState} from './state.mjs';
export const handler=event=>handleState(event,true);
