const { token, bfd_token, bfd_authorization, top_token, top_authorization, dbl_token, dbl_authorization } = require('../config.json');
import { start } from './paw';

start(token, bfd_token, bfd_authorization, top_token, top_authorization, dbl_token, dbl_authorization);