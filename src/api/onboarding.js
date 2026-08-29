import { apiFetch } from './apiClient.js';
export async function getOnboardingStatus(){const d=await apiFetch('/households/onboarding-status');return d.onboarding;}
export async function createOpeningWallet({name,actual_balance,idempotency_key}){return apiFetch('/households/onboarding/opening-wallet',{method:'POST',headers:{'Idempotency-Key':idempotency_key},body:JSON.stringify({name,actual_balance,idempotency_key})});}
export async function completeDashboardTour(version=1){const d=await apiFetch('/households/onboarding/tour/complete',{method:'POST',body:JSON.stringify({version})});return d.onboarding;}
export async function restartDashboardTour(){const d=await apiFetch('/households/onboarding/tour/restart',{method:'POST'});return d.onboarding;}
