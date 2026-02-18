import type { PassportStatic } from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { config } from "../../config/config.js";
import type { AuthService } from "./auth.service.js";
import type { AuthRepository } from "./auth.repository.js";


export default function configurePassport(
    passport: PassportStatic,
    authService: AuthService,
    _authRepo: AuthRepository
) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: config.auth.google.client_id!,
                clientSecret: config.auth.google.client_secret!,
                callbackURL: config.auth.google.callback_url!,
                proxy: true
            },
            async (_, __, profile, done) => {
                try {
                    const user = await authService.handleGoogleLogin(profile);
                    done(null, user);
                } catch (error) {
                    done(error);
                }
            }
        )
    );

    passport.serializeUser((user: any, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
        try {
            const user = await authService.deserializeUser(id);
            done(null, user);
        } catch (err) {
            done(err);
        }
    });
}
