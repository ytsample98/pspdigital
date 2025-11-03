import React, { useState, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import PropTypes from 'prop-types';

/*
  CommentDialog

  Props:
    - show (bool)
    - onClose (fn)
    - cm (object) : countermeasure being discussed
    - history (array) : chronological list from countermeasure_log
    - onSubmitComment (fn(commentText)) : parent handler that will call backend and refresh data

  History expected items:
    { id, type, text, logged_by, logged_by_name, timestamp }
    where type ∈ ['User Comment', 'Acceptance Remark', 'Rejection Remark']
*/

export default function CommentDialog({ show, onClose, cm, history = [], onSubmitComment }) {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sortedHistory, setSortedHistory] = useState([]);

  useEffect(() => {
    try {
      const copy = Array.isArray(history) ? history.slice() : [];
      copy.sort((a, b) => {
        const ta = a && a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b && b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return ta - tb;
      });
      setSortedHistory(copy);
    } catch (err) {
      setSortedHistory(history || []);
    }
  }, [history, show]);

  useEffect(() => {
    if (!show) {
      setCommentText('');
      setSubmitting(false);
    }
  }, [show]);

  const handleSubmit = async () => {
    const txt = (commentText || '').toString().trim();
    if (!txt) return alert('Please enter a comment before submitting.');
    if (typeof onSubmitComment !== 'function') {
      console.error('onSubmitComment is not a function');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmitComment(txt);
      setCommentText('');
    } catch (err) {
      console.error('submit comment failed', err);
      alert('Failed to submit comment. See console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderEntry = (entry) => {
    const type = (entry && entry.type || '').toString();
    const text = entry && (entry.text || '');
    const author = entry && (entry.logged_by_name || entry.logged_by || 'System');
    const ts = entry && entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '';

    if (type === 'Acceptance Remark') {
      return (
        <div key={entry.id} className="mb-2">
          <div className="p-3" style={{ border: '2px solid #28a745', borderRadius: 8, backgroundColor: '#eafaf0' }}>
            <div style={{ fontWeight: 700, color: '#155724' }}>Approver's Remark (Accepted)</div>
            <div className="mt-2" style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
            <div className="text-muted small mt-2">{author} — {ts}</div>
          </div>
        </div>
      );
    }

    if (type === 'Rejection Remark') {
      return (
        <div key={entry.id} className="mb-2">
          <div className="p-3" style={{ border: '2px solid #dc3545', borderRadius: 8, backgroundColor: '#fdecea' }}>
            <div style={{ fontWeight: 700, color: '#721c24' }}>Approver's Rejection Reason</div>
            <div className="mt-2" style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
            <div className="text-muted small mt-2">{author} — {ts}</div>
          </div>
        </div>
      );
    }

    // Default: user comment
    return (
      <div key={entry.id} className="mb-2">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{
            alignSelf: 'flex-start',
            maxWidth: '85%',
            padding: '10px 14px',
            borderRadius: 12,
            backgroundColor: '#f1f3f5',
            whiteSpace: 'pre-wrap'
          }}>
            <div style={{ fontSize: 14 }}>{text}</div>
          </div>
          <div className="text-muted small mt-1">{author} — {ts}</div>
        </div>
      </div>
    );
  };

  const cmTitle = cm ? (cm.countermeasure || cm.description || `ID: ${cm.id || 'unsaved'}`) : 'Countermeasure';

  return (
    <Modal show={!!show} onHide={onClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Comments — {cmTitle}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ maxHeight: '45vh', overflowY: 'auto', paddingBottom: 12 }}>
          {(!sortedHistory || sortedHistory.length === 0) ? (
            <div className="text-center text-muted">No history yet. Be the first to comment.</div>
          ) : (
            sortedHistory.map((entry) => renderEntry(entry))
          )}
        </div>

        <hr />

        <div>
          <label htmlFor="comment-input"><strong>Add a comment</strong></label>
          <textarea
            id="comment-input"
            className="form-control"
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Type your comment here..."
            disabled={submitting}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>Close</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Comment'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

CommentDialog.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func,
  cm: PropTypes.object,
  history: PropTypes.array,
  onSubmitComment: PropTypes.func
};

CommentDialog.defaultProps = {
  show: false,
  onClose: () => { },
  cm: null,
  history: [],
  onSubmitComment: async () => { }
};