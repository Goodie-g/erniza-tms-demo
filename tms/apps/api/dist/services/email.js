import { config } from '../config.js';
/**
 * Minimal email adapter. In development (or when no provider is configured)
 * messages are written to the server log so password-reset can be tested.
 * Production deployments must set RESEND_API_KEY.
 */
export async function sendEmail(input) {
    if (!config.resendApiKey) {
        if (config.isProduction) {
            throw new Error('Email provider is not configured (RESEND_API_KEY is required in production).');
        }
        const attachmentSummary = input.attachments?.length
            ? ` attachments=${input.attachments.map((attachment) => attachment.filename).join(', ')}`
            : '';
        // eslint-disable-next-line no-console
        console.info(`[email:development] to=${input.to} subject="${input.subject}"${attachmentSummary}\n${input.text}`);
        return;
    }
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.resendApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: config.emailFrom,
            to: [input.to],
            subject: input.subject,
            html: input.html,
            text: input.text,
            attachments: input.attachments?.map((attachment) => ({
                filename: attachment.filename,
                content: typeof attachment.content === 'string'
                    ? attachment.content
                    : Buffer.from(attachment.content).toString('base64'),
                type: attachment.contentType,
            })),
        }),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Email delivery failed (${response.status}): ${body.slice(0, 300)}`);
    }
}
export function passwordResetEmail(name, resetUrl) {
    return {
        subject: 'Reset your Erniza TMS password',
        text: `Hello ${name},\n\nA password reset was requested for your Erniza TMS account.\n\nReset link (valid for 60 minutes): ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Hello ${escapeHtml(name)},</p><p>A password reset was requested for your Erniza TMS account.</p><p><a href="${resetUrl}">Reset your password</a> (valid for 60 minutes).</p><p>If you did not request this, you can ignore this email.</p>`,
    };
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[character];
    });
}
