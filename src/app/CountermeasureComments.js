import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import CommentDialog from './CommentDialog';

/*
  CountermeasureComments

  - A reusable component that fetches the entire countermeasure_log history for a given countermeasure id,
    displays it and allows submitting new user comments.
  - On submit of a user comment:
      * POSTs the comment into countermeasure_log (log_type = 'User Comment')
      * If the CM's status was 'Pending', updates the countermeasure to status 'For Validation'
        via PUT /api/countermeasure/:id (partial update expected)
  - It renders nothing by itself; it manages state and opens the CommentDialog UI.
  - Props:
      cmId (required) - countermeasure id to fetch logs for
      show (bool) - whether the dialog should be visible
      onClose (fn) - called when the dialog is closed
      onUpdated (fn) - optional callback invoked after a successful comment submit or log refresh,
                       signature: (updatedLogs, updatedCm) => {}
*/
export default function CountermeasureComments({ cmId, show, onClose, onUpdated }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cm, setCm] = useState(null);

  const fetchHistory = async () => {
    if (!cmId) return;
    setLoading(true);
    try {
      // Fetch countermeasure logs (assumes endpoint exists)
      const logsRes = await axios.get(`/api/countermeasure/${cmId}/logs`);
      const cmRes = await axios.get(`/api/countermeasure/${cmId}`);
      setHistory(Array.isArray(logsRes.data) ? logsRes.data : []);
      setCm(cmRes.data || null);
      if (typeof onUpdated === 'function') onUpdated(logsRes.data || [], cmRes.data || null);
    } catch (err) {
      console.error('Failed to load countermeasure history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show && cmId) fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, cmId]);

  const submitComment = async (text) => {
    if (!cmId) return;
    setSubmitting(true);
    try {
      const user = JSON.parse(localStorage.getItem('dcmsUser') || '{}');
      // Insert into countermeasure_log
      await axios.post(`/api/countermeasure/${cmId}/logs`, {
        log_type: 'User Comment',
        text,
        logged_by: user.id || null
      });

      // If countermeasure is currently Pending -> change to For Validation
      // Attempt to get current CM status if not loaded
      let currentCm = cm;
      if (!currentCm) {
        const res = await axios.get(`/api/countermeasure/${cmId}`);
        currentCm = res.data;
      }

      if (currentCm && (currentCm.cm_status || currentCm.status || '').toString().toLowerCase() === 'pending') {
        try {
          await axios.put(`/api/countermeasure/${cmId}`, {
            cm_status: 'For Validation'
          });
        } catch (err) {
          // non-fatal, but log
          console.warn('Failed to update countermeasure status to For Validation', err);
        }
      }

      // refresh history and CM
      await fetchHistory();
    } catch (err) {
      console.error('submitComment failed', err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CommentDialog
      show={!!show}
      onClose={onClose}
      cm={cm}
      history={history}
      onSubmitComment={submitComment}
      submitting={submitting}
      loading={loading}
    />
  );
}

CountermeasureComments.propTypes = {
  cmId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  show: PropTypes.bool,
  onClose: PropTypes.func,
  onUpdated: PropTypes.func
};

CountermeasureComments.defaultProps = {
  show: false,
  onClose: () => {},
  onUpdated: () => {}
};