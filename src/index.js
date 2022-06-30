const { token, bfd_token, bfd_authorization, top_token, top_authorization, dbl_token, dbl_authorization } = require('../config.json');
const { start } = require('./paw');

start(token, bfd_token, bfd_authorization, top_token, top_authorization, dbl_token, dbl_authorization);