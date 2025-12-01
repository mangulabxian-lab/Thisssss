const AuditLog = require('../models/AuditLog');

const auditLog = async (req, res, next) => {
  const originalSend = res.json;
  
  res.json = function(data) {
    // Store the response data
    res.locals.responseData = data;
    
    // Log the action if it's an admin action
    if (req.admin && req.method !== 'GET') {
      const auditLog = new AuditLog({
        adminId: req.admin._id,
        action: req.method,
        entity: req.baseUrl.replace('/api/admin/', ''),
        entityId: req.params.id,
        details: {
          body: req.body,
          response: data,
          params: req.params,
          query: req.query
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      auditLog.save().catch(console.error);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = auditLog;