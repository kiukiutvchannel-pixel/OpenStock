'use client';

import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import { signInWithEmail } from "@/lib/actions/auth.actions";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OpenDevSocietyBranding from "@/components/OpenDevSocietyBranding";
import SocialAuthButtons from "@/components/forms/SocialAuthButtons";
import React from "react";
import { zh } from "@/lib/i18n/zh-Hant";

const SignIn = () => {
    const router = useRouter()
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<SignInFormData>({
        defaultValues: {
            email: '',
            password: '',
        },
        mode: 'onBlur',
    });

    const onSubmit = async (data: SignInFormData) => {
        try {
            const result = await signInWithEmail(data);
            if (result.success) {
                router.push('/dashboard');
                return;
            }
            toast.error(zh.auth.signInFailed, {
                description: result.error ?? zh.auth.invalidCredentials,
            });
        } catch (e) {
            console.error(e);
            toast.error(zh.auth.signInFailed, {
                description: e instanceof Error ? e.message : zh.auth.signInError
            })
        }
    }

    return (
        <>
            <h1 className="form-title mb-2">{zh.auth.welcome}</h1>
            <p className="mb-8 text-faint">{zh.auth.welcomeSub}</p>

            <SocialAuthButtons />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="email"
                    label={zh.auth.email}
                    placeholder="you@example.com"
                    register={register}
                    error={errors.email}
                    validation={{
                        required: zh.auth.emailRequired,
                        pattern: {
                            value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
                            message: zh.auth.emailInvalid
                        }
                    }}
                />

                <InputField
                    name="password"
                    label={zh.auth.password}
                    placeholder={zh.auth.passwordPlaceholder}
                    type="password"
                    register={register}
                    error={errors.password}
                    validation={{ required: zh.auth.passwordRequired, minLength: { value: 8, message: zh.auth.passwordMin } }}
                />

                <div className="flex justify-end">
                    <Link href="/forgot-password" className="footer-link text-sm">
                        {zh.auth.forgot}
                    </Link>
                </div>

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? zh.auth.signingIn : zh.auth.signIn}
                </Button>

                <FooterLink text={zh.auth.noAccount} linkText={zh.auth.createAccount} href="/sign-up" />
                <OpenDevSocietyBranding outerClassName="mt-10 flex justify-center" />
            </form>
        </>
    );
};
export default SignIn;
