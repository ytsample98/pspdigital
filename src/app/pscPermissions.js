import axios from 'axios';

// Assumptions:
// - escalation.time_duration is in hours (if your data uses days, adjust conversion)
// - escalation.authority is a string that matches a user's responsibility/page name
// - stage order: plan -> do -> check -> action

export const stageOrder = ['Plan','Do','Check','Action'];
export const stageToPage = { Plan: 'psclist', Do: 'corrective', Check: 'rootcause', Action: 'effect' };

export async function loadEscalations() {
  try {
    const res = await axios.get('/api/escalation');
    return res.data || [];
  } catch (e) {
    console.warn('Could not load escalations', e);
    return [];
  }
}

export function hoursSince(dateStr) {
  try {
    const then = new Date(dateStr);
    const diff = Date.now() - then.getTime();
    return diff / (1000 * 60 * 60);
  } catch (e) { return 0; }
}

export function computeEscalationForPsc(psc, escalations) {
  if (!psc || !escalations || escalations.length === 0) return null;

  const hrs = hoursSince(psc.date || psc.created_at || psc.createdAt || new Date());

  const sorted = escalations
    .map(e => ({ ...e, time_duration_num: Number(e.time_duration) || 0 }))
    .filter(e => !isNaN(e.time_duration_num))
    .sort((a, b) => a.time_duration_num - b.time_duration_num);

  const matched = sorted.filter(e => hrs >= e.time_duration_num);
  return matched.length ? matched[matched.length - 1] : sorted[0];
}

export function getControllerForStage(stage, escalation) {
  if (escalation) {
    if (escalation.authority) return escalation.authority;
    if (escalation.authority_id) return escalation.authority_id;
    if (escalation.authorityId) return escalation.authorityId;
  }
  return stageToPage[stage] || null;
}

// fieldsToStage: map basic field keys to the stage that owns them
const fieldsToStage = {
  // plan fields
  problem_description: 'Plan', short_description: 'Plan', initiator_name: 'Plan', date: 'Plan', shift: 'Plan', value_stream_line: 'Plan', line_code: 'Plan', qty_affected: 'Plan', part_affected: 'Plan', supplier: 'Plan',
  // do/corrective
  'corrective.initialContainmentAction': 'Do', 'corrective.assignTo': 'Do', 'corrective.targetDate': 'Do', 'corrective.remarks': 'Do',
  // root cause
  symptom: 'Check', why1: 'Check', why2: 'Check', why3: 'Check', why4: 'Check', why5: 'Check', 'root_cause.remarks': 'Check',
  // effect
  effectiveness_checked: 'Action', effectiveness_date: 'Action', effectiveness_remarks: 'Action'
};

export function getFieldStage(fieldKey) {
  if (fieldsToStage[fieldKey]) return fieldsToStage[fieldKey];
  if (fieldKey.startsWith('corrective') || fieldKey.startsWith('initialContainmentAction')) return 'Do';
  if (fieldKey.startsWith('why') || fieldKey.startsWith('symptom')) return 'Check';
  return 'Plan';
}

export function isFieldEditable(fieldKey, psc, user, escalation) {
  if (!user) return false;
  if (!psc) return false;

  const userRespId = user?.user_resp_id || user?.userresp || null;
  const userRespName = user?.resp_name || user?.user_responsibility || null;
  const userPages = Array.isArray(user?.pages) ? user.pages : [];

  // ✅ If escalation authority_id matches user's responsibility ID → allow edit
  if (escalation?.authority_id) {
    return String(escalation.authority_id) === String(userRespId);
  }

  // ✅ If escalation authority name is used (fallback)
  if (escalation?.authority) {
    const authName = String(escalation.authority).trim();
    return (userRespName === authName || userPages.includes(authName));
  }

  // ✅ If no escalation authority, allow based on page access (optional fallback)
  const ctrlPage = getControllerForStage(psc.ticket_stage || psc.ticketStage || 'Plan', escalation);
  return userPages.includes(ctrlPage) || userRespName === ctrlPage;
}