import { db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";

export type PlanType = 'free' | 'starter' | 'pro' | 'admin';

interface PlanLimits {
  dailyMax: number;
  perConversationMax: number;
}

const LIMITS: Record<PlanType, PlanLimits> = {
  free: { dailyMax: 10, perConversationMax: 5 },
  starter: { dailyMax: 50, perConversationMax: 20 },
  pro: { dailyMax: 200, perConversationMax: 50 },
  admin: { dailyMax: 1000, perConversationMax: 200 }
};

export const getPlan = (email?: string | null): PlanType => {
  if (!email) return 'free';
  const admins = ["henrique.rosa@poli.ufrj.br", "brunool.rj@gmail.com"];
  if (admins.includes(email)) return 'admin';
  
  // Aqui você poderá adicionar lógica para verificar no Firestore 
  // se o usuário tem uma assinatura ativa 'starter' ou 'pro'
  return 'free';
};

export const getLimits = (plan: PlanType): PlanLimits => {
  return LIMITS[plan];
};

export const checkDailyLimit = async (uid: string, plan: PlanType) => {
  const today = new Date().toISOString().split('T')[0];
  const usageRef = doc(db, "usage", uid);
  const limits = getLimits(plan);

  try {
    const usageDoc = await getDoc(usageRef);
    
    if (!usageDoc.exists()) {
      // First usage of all time for this user
      return { 
        allowed: true, 
        remaining: limits.dailyMax, 
        dailyMax: limits.dailyMax 
      };
    }

    const data = usageDoc.data();
    if (data.lastReset !== today) {
      // It's a new day!
      return { 
        allowed: true, 
        remaining: limits.dailyMax, 
        dailyMax: limits.dailyMax 
      };
    }

    const currentCount = data.count || 0;
    const remaining = Math.max(0, limits.dailyMax - currentCount);

    return {
      allowed: currentCount < limits.dailyMax,
      remaining,
      dailyMax: limits.dailyMax
    };
  } catch (error) {
    console.error("Error checking daily limit:", error);
    // Fallback security: allow but log error
    return { allowed: true, remaining: 1, dailyMax: limits.dailyMax };
  }
};

export const incrementUsage = async (uid: string) => {
  const today = new Date().toISOString().split('T')[0];
  const usageRef = doc(db, "usage", uid);

  try {
    const usageDoc = await getDoc(usageRef);
    
    if (!usageDoc.exists() || usageDoc.data().lastReset !== today) {
      // Initialize or reset for the new day
      await setDoc(usageRef, {
        count: 1,
        lastReset: today,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else {
      // Increment existing count
      await updateDoc(usageRef, {
        count: increment(1),
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Error incrementing usage:", error);
  }
};
