// lib/execution/notifications.ts
// Execution Notifications

import { supabase } from "@/lib/supabase";

interface NotificationChannel {
  email?: string;
  whatsapp?: string;
  phone?: string;
}

interface NotificationParams {
  executionId: string;
  participantId: string;
  participantName: string;
  signingLink: string;
  channels: NotificationChannel;
}

export async function sendExecutionNotifications(params: NotificationParams): Promise<void> {
  const { executionId, participantId, participantName, signingLink, channels } = params;

  console.log(`📧 Sending notifications for ${participantName} (Execution: ${executionId})`);

  // 1. Email Notification
  if (channels.email) {
    await sendEmailNotification({
      to: channels.email,
      name: participantName,
      signingLink,
      executionId,
    });
  }

  // 2. WhatsApp Notification
  if (channels.whatsapp) {
    await sendWhatsAppNotification({
      to: channels.whatsapp,
      name: participantName,
      signingLink,
      executionId,
    });
  }

  // 3. SMS Notification (future)
  if (channels.phone) {
    // await sendSMSNotification({ ... });
  }

  // 4. In-app notification (always sent)
  await sendInAppNotification({
    executionId,
    participantId,
    participantName,
    signingLink,
  });
}

// ============================================================
// Email Notification
// ============================================================

async function sendEmailNotification(params: {
  to: string;
  name: string;
  signingLink: string;
  executionId: string;
}): Promise<void> {
  const subject = '📄 Please Review & Sign Your Lease Agreement';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #34d399;">
        <h1 style="color: #ffffff; font-size: 24px;">AssetFlow</h1>
        <p style="color: #888;">Secure Signing</p>
      </div>
      <div style="padding: 24px 0;">
        <p style="color: #e0e0e0; font-size: 16px;">Hello <strong>${params.name}</strong>,</p>
        <p style="color: #e0e0e0; font-size: 16px; margin-top: 16px;">
          A lease agreement has been prepared for your review and signature.
        </p>
        <p style="color: #e0e0e0; font-size: 16px; margin-top: 16px;">
          Please click the button below to review and sign the lease:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${params.signingLink}" 
             style="background: #34d399; color: #0a0a0a; padding: 14px 32px; 
                    text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Review & Sign
          </a>
        </div>
        <p style="color: #888; font-size: 14px;">
          This link will expire in 14 days.
        </p>
        <p style="color: #555; font-size: 12px; margin-top: 24px;">
          Execution ID: ${params.executionId}
        </p>
      </div>
      <div style="border-top: 1px solid #2a2a2a; padding-top: 16px; text-align: center; color: #555; font-size: 12px;">
        <p>© ${new Date().getFullYear()} AssetFlow. All rights reserved.</p>
        <p>This is an automated message. Please do not reply.</p>
      </div>
    </div>
  `;

  // TODO: Integrate with SendGrid
  // await sendEmail(params.to, subject, html);
  
  console.log(`📧 Email would be sent to ${params.to}`);
  console.log(`📧 Link: ${params.signingLink}`);
}

// ============================================================
// WhatsApp Notification
// ============================================================

async function sendWhatsAppNotification(params: {
  to: string;
  name: string;
  signingLink: string;
  executionId: string;
}): Promise<void> {
  const message = `
Hello ${params.name}!

A lease agreement is ready for your review and signature.

Click here to sign: ${params.signingLink}

Execution ID: ${params.executionId}

This link will expire in 14 days.

Thank you,
AssetFlow Team
  `;

  // TODO: Integrate with Twilio WhatsApp
  // await sendWhatsApp(params.to, message);
  
  console.log(`📱 WhatsApp would be sent to ${params.to}`);
  console.log(`📱 Message: ${message}`);
}

// ============================================================
// In-App Notification
// ============================================================

async function sendInAppNotification(params: {
  executionId: string;
  participantId: string;
  participantName: string;
  signingLink: string;
}): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .insert({
        user_id: params.participantId,
        title: 'Lease Ready for Signature',
        body: `${params.participantName}, a lease agreement is ready for your review and signature.`,
        link: params.signingLink,
        source_type: 'execution',
        source_id: params.executionId,
        read: false,
        created_at: new Date().toISOString(),
      });
    console.log(`✅ In-app notification created for ${params.participantName}`);
  } catch (error) {
    console.error('In-app notification error:', error);
  }
}

// ============================================================
// Reminder Notifications
// ============================================================

export async function sendReminderNotifications(): Promise<void> {
  // Find executions that have been sent for more than 3 days
  // and have participants who haven't signed yet
  
  console.log('⏰ Checking for reminders...');
  
  try {
    const { data: executions } = await supabase
      .from('executions')
      .select('id, sent_at')
      .eq('status', 'sent')
      .or('status.eq.partially_signed')
      .lt('sent_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());

    if (!executions || executions.length === 0) {
      console.log('No reminders needed');
      return;
    }

    for (const exec of executions) {
      const { data: participants } = await supabase
        .from('execution_participants')
        .select('*')
        .eq('execution_id', exec.id)
        .eq('status', 'pending');

      if (!participants || participants.length === 0) continue;

      for (const p of participants) {
        console.log(`🔔 Reminder sent to ${p.name}`);
        // TODO: Actually send reminder
      }
    }
  } catch (error) {
    console.error('Reminder error:', error);
  }
}

// ============================================================
// Escalation Notifications
// ============================================================

export async function sendEscalationNotifications(): Promise<void> {
  // Find executions that have been sent for more than 7 days
  // and have participants who haven't signed yet
  // Escalate to manager/admin
  
  console.log('🚨 Checking for escalations...');
  
  // TODO: Implement escalation logic
}
