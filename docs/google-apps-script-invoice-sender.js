// Paste this into https://script.google.com as Code.gs.
// Change SHARED_SECRET to the same value you put in SEND_INVOICE_SECRET.
const SHARED_SECRET = 'change-this-secret';

function doGet() {
  return jsonResponse({
    success: true,
    status: 'ready',
    quota_remaining: MailApp.getRemainingDailyQuota()
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');

    if (SHARED_SECRET && payload.secret !== SHARED_SECRET) {
      throw new Error('Unauthorized sender secret.');
    }

    const invoice = payload.invoice || {};
    const attachment = payload.attachment || {};

    if (!invoice.to) {
      throw new Error('Missing customer email.');
    }

    const attachments = [];

    if (attachment.content_base64) {
      const bytes = Utilities.base64Decode(attachment.content_base64);
      attachments.push(
        Utilities.newBlob(
          bytes,
          attachment.content_type || 'application/pdf',
          attachment.file_name || `${invoice.invoice_number || 'invoice'}.pdf`
        )
      );
    }

    MailApp.sendEmail({
      to: invoice.to,
      subject: invoice.subject || `Invoice ${invoice.invoice_number || ''}`.trim(),
      body: invoice.body || 'Attached is your invoice.',
      name: invoice.company_name || undefined,
      attachments
    });

    return jsonResponse({
      success: true,
      provider: 'google_apps_script',
      message_id: `apps-script-${Date.now()}`,
      quota_remaining: MailApp.getRemainingDailyQuota()
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
