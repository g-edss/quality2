import { Router } from 'express';
import { login } from '../controllers/auth.controller.js';
import { revisarBloqueo } from '../middlewares/limiteLogin.js';

const router = Router();

router.post('/login', revisarBloqueo, login);

export default router;
