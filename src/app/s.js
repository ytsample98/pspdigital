const [countermeasures, setCountermeasures] = useState([]);
const [latest, setLatest] = useState({});
const [showForm, setShowForm] = useState(false);

const handleCountermeasureChange = (field, value) => {
  setLatest(prev => ({ ...prev, [field]: value }));
};

const saveCountermeasure = () => {
  if (!latest.description || !latest.targetDate) {
    alert("Please fill all required fields.");
    return;
  }

  // Add the new one to the table
  setCountermeasures(prev => [...prev, { ...latest, id: Date.now() }]);

  // Clear form
  setLatest({});
  setShowForm(false);
};
