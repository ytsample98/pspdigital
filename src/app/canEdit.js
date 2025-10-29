// useCanEdit.js
import { useMemo } from "react";
import { isFieldEditable } from "./pscPermissions";

export function useCanEdit(selected, activeEsc, fields = []) {
  return useMemo(() => {
    if (!selected) return false;

    const user = (() => {
      try {
        console.log('dcmsUser', localStorage.getItem('dcmsUser'));  
        return JSON.parse(localStorage.getItem('dcmsUser'));
      } catch (e) {
        return null;
      }
    })();

    const defaultFields = [
      'symptom', 'why1', 'why2', 'why3', 'why4', 'why5',
      'corrective.initialContainmentAction', 'corrective.doneBy',
      'corrective.assignTo', 'corrective.targetDate', 'corrective.remarks',
      'effectiveness_checked', 'effectiveness_remarks', 'effectiveness_date'
    ];

    const checkFields = fields.length ? fields : defaultFields;

    return checkFields.some(field =>
      isFieldEditable(field, selected, user, activeEsc)
    );
  }, [selected, activeEsc, fields]);
}
