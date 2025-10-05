import { useEffect, useState } from 'react';
import { supabase } from '../config/api';

export function useLiveRecommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialRecommendations();

    const channel = supabase
      .channel('live-recommendations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recommendations',
        },
        (payload) => {
          console.log('🆕 New recommendation received:', payload.new);
          setRecommendations((prev) => {
            const newRec = payload.new;
            const exists = prev.some(r => r.id === newRec.id);
            if (exists) return prev;
            return [newRec, ...prev].slice(0, 50);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recommendations',
        },
        (payload) => {
          console.log('🔄 Recommendation updated:', payload.new);
          setRecommendations((prev) =>
            prev.map((r) => (r.id === payload.new.id ? payload.new : r))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInitialRecommendations = async () => {
    try {
      const { data, error } = await supabase
        .from('scan_recommendations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRecommendations(data || []);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  return { recommendations, loading };
}

export function useLiveScanStatus() {
  const [scanStatus, setScanStatus] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    fetchCurrentScan();

    const channel = supabase
      .channel('live-scan-status')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_runs',
        },
        (payload) => {
          console.log('📊 Scan status update:', payload);

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const scan = payload.new;
            setScanStatus(scan);
            setIsScanning(scan.status === 'running');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCurrentScan = async () => {
    try {
      const { data, error } = await supabase
        .from('scan_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setScanStatus(data);
        setIsScanning(data.status === 'running');
      }
    } catch (err) {
      console.error('Error fetching scan status:', err);
    }
  };

  return { scanStatus, isScanning };
}

export function useLiveNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('🔔 New notification:', payload.new);
          setNotifications((prev) => [payload.new, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === payload.new.id ? payload.new : n))
          );
          if (payload.new.is_read && !payload.old.is_read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.is_read).length || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  return { notifications, unreadCount, markAsRead };
}
