const { test_token, bfd_token, top_token, top_authorization, dbl_token, dbl_authorization } = require('./config.json');
const { start } = require('./paw');

start(test_token, bfd_token, top_token, top_authorization, dbl_token, dbl_authorization);