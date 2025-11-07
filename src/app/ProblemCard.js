import React from "react";
import "../assets/styles/ProblemCard.css";
import {activeEsc} from  './PSCFullView.js';

function field(p, snake, camel) {
  return p[snake] ?? p[camel] ?? '';
}

function getRootCauseObj(p) {
  const rcRaw = p.root_cause ?? p.rootCause ?? null;
  if (!rcRaw) return {};
  if (typeof rcRaw === 'string') {
    try { return JSON.parse(rcRaw || '{}'); } catch { return {}; }
  }
  return rcRaw;
}

function getWhyList(rootCauseObj, p) {
  return [
    rootCauseObj.why1 || rootCauseObj.why_1 || p.why1 || p.why_1 || '',
    rootCauseObj.why2 || rootCauseObj.why_2 || p.why2 || p.why_2 || '',
    rootCauseObj.why3 || rootCauseObj.why_3 || p.why3 || p.why_3 || '',
    rootCauseObj.why4 || rootCauseObj.why_4 || p.why4 || p.why_4 || '',
    rootCauseObj.why5 || rootCauseObj.why_5 || p.why5 || p.why_5 || ''
  ].filter(w => w && w.toString().trim() !== '');
}

function getCountermeasuresList(rootCauseObj) {
  let countermeasuresList = [];
  if (rootCauseObj.countermeasures && Array.isArray(rootCauseObj.countermeasures)) {
    countermeasuresList = rootCauseObj.countermeasures;
  } else if (typeof rootCauseObj.countermeasures === 'string') {
    try {
      countermeasuresList = JSON.parse(rootCauseObj.countermeasures);
    } catch {
      countermeasuresList = [];
    }
  }
  return countermeasuresList;
}

// Dummy editableHint implementation, adjust as you need
function editableHint(fieldKey) {
  return {};
}

const ProblemCard = ({ psc = {},activeEsc=null }) => {
  const p = psc || {};
  const rootCauseObj = getRootCauseObj(p);
  const whyList = getWhyList(rootCauseObj, p);
  const countermeasuresList = getCountermeasuresList(rootCauseObj);
  const firstCm = countermeasuresList.length > 0 ? countermeasuresList[0] : {};
  const date = p.date ? new Date(p.date) : null;
  const year = date ? date.getFullYear() : '';
  const problemNo = field(p, 'problem_number', 'problemNumber');

  // Start rendering, but only substitute values where you described:
  return (
    <div className="problemcard">
      <div className="card">
        {/* Header */}
        <div className="header">
          <span>
            Problem solving card / No.-Year: <strong>{problemNo ? `${problemNo}${year ? '-' + year : ''}` : "-20"}</strong>
          </span>
          <div className="logo">MAHLE</div>
        </div>

        <div className="section">
          <div className="row">
            <label>
              Name: <span className="readonly">{field(p, 'initiator_name', 'initiatorName') || "Arunkumar"}</span>
            </label>
            <label>
              Date:<span className="readonly">{date ? date.toLocaleDateString('en-CA') : "05/11/2025"}</span>
            </label>
            <label>
              Shift: <span className="readonly">{p.shift || "A"}</span>
            </label>
          </div>

          <div className="row">
            <label>
              Time: from <span className="readonly">08:00</span> to <span className="readonly">17:00</span>
            </label>
            <label>
              KPI: <span className="readonly">Quality</span>
            </label>
            <label>
              S Q D C: <span className="readonly">Q</span>
            </label>
          </div>
        </div>

        <div className="section" style={{ padding: "0px" }}>
          <div className="description-box">
            <div className="description-header">
              <label className="line-label">
                Line: <span className="readonly">{p.line_code || p.lineCode || p.line || "Line-1"}</span>
              </label>
            </div>
            <label className="textarea-label">
              What happened / Description:
              <textarea
                readOnly
                className="no-border-textarea"
                rows="4"
                value={p.problem_description || p.problemDescription || "Sample description of problem..."}
                style={{ minHeight: 60, ...editableHint("problem_description") }}
              />
            </label>
          </div>
        </div>

        {/* Root Cause */}
        <div className="section root-cause-section">
          <h4 className="section-title">Root Cause Analysis / 5W</h4>
          <div className="root-cause" style={{ border: "1px solid #ddd", padding: 8, minHeight: 120 }}>
            {whyList.length > 0
              ? whyList.map((w, i) => (
                  <div key={i} style={editableHint(`why${i + 1}`)}>
                    <strong>Why {i + 1}:</strong> {w}
                  </div>
                ))
              : (
                <>
                  <p>Why:</p>
                  <p>Why:</p>
                  <p>Why:</p>
                  <p>Why:</p>
                  <p>Why:</p>
                </>
              )}
          </div>
        </div>

        {/* Planned Countermeasure */}
        <div className="section planned-section">
          <label className="textarea-label">
            Planned countermeasure ? / Description:
            <textarea
              readOnly
              className="no-border-textarea"
              rows="3"
              value={firstCm.countermeasure || firstCm.description || "Enter countermeasure here..."}
            />
          </label>
        </div>

        {/* Responsible */}
        <div className="section">
          <div className="row">
            <label>
              Responsible: <span className="readonly">{firstCm.doneBy || firstCm.responsible || "Arunkumar"}</span>
            </label>
            <label>
              Date: <span className="readonly">{firstCm.targetDate || "05/11/2025"}</span>
            </label>
            <label>
              Shift: <span className="readonly">{firstCm.shift || "A"}</span>
            </label>
          </div>
        </div>

       
        <div className="section">
          <div className="row">
            <label className="textarea-label">
              Effectiveness check / Description:
              <textarea
                readOnly
                className="no-border-textarea"
                rows="3"
                value={p.effectiveness_remarks || p.effectivenessRemarks || "Effectiveness verified successfully."}
                style={editableHint("effectiveness_remarks")}
              />
            </label>
          </div>
          <div className="row">
            <label>
              Responsible: <span className="readonly">{p.effectiveness_checked || p.effectivenessCheck || "John"}</span>
            </label>
            <label>
              Date: <span className="readonly">{p.effectiveness_date || p.effectivenessDate || "05/11/2025"}</span>
            </label>
            <label>
              Shift: <span className="readonly">{p.shift || "B"}</span>
            </label>
          </div>
        </div>

        {/* Done & Escalation */}
        <div className="section bottom planned-section">
          <label>
            Done:{" "}
            <div className="signature-area">
              <div className="signature-line"></div>
              <div className="signature-label">(Signature problem owner)</div>
            </div>
          </label>

          {/* <label>
            New card no.: <span className="readonly">{problemNo ? problemNo : "-20"}</span>
          </label>
           */}
<div className="escalation">
  <div className="label-text">Escalation to Level:</div>
  <div className="span-group">
    {['L1', 'L2', 'L3'].map(lvl => {
      const levelNum = lvl.replace('L', ''); // '1', '2', '3'
      const activeLevelNum =
        activeEsc?.level?.toString() || // numeric or string level (1, 2, 3)
        activeEsc?.escalation_name?.match(/\d+/)?.[0] || // extract number from 'level 1'
        null;

      const isActive = activeLevelNum === levelNum;

      return (
        <span 
          key={lvl}
          className={`badge ${isActive ? 'badge badge-danger' : 'badge badge-secondary'}`}
          disabled // prevent clicking
        >
          {lvl}
        </span>
      );
    })}
  </div>
</div>

        </div>
       

        {/* Footer 
        <div className="footer">
          <span>Card stays with problem owner</span>
          <span>Main card (BLUE) → Archiving Class J</span>
        </div>*/}
      </div>
    </div>
  );
};

export default ProblemCard;