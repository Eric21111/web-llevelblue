import { supabase } from "../config/db.js";
import { createFeedbackHandlers } from "../services/feedbackService.js";

export const { getFeedback, addFeedback } = createFeedbackHandlers(supabase);
