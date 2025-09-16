import { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const useAttendance = (token: string) => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);

  const markAttendance = async (status: "present" | "absent") => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_URL}/attendance`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAttendance((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Attendance error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getAttendanceHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAttendance(res.data);
    } catch (err) {
      console.error("Attendance fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return { attendance, loading, markAttendance, getAttendanceHistory };
};
