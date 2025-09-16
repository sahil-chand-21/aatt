import { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const useLeave = (token: string) => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);

  const applyLeave = async (reason: string, fromDate: string, toDate: string) => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/leave`,
        { reason, fromDate, toDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLeaves((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Leave apply error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getLeaves = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/leave`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeaves(res.data);
    } catch (err) {
      console.error("Leave fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return { leaves, loading, applyLeave, getLeaves };
};
