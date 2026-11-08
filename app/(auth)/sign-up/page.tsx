'use client';

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import ChoiceChips from "@/components/forms/ChoiceChips";
import PasswordRequirements from "@/components/forms/PasswordRequirements";
import { INVESTMENT_GOALS, PASSWORD_VALIDATION, PREFERRED_INDUSTRIES, RISK_TOLERANCE_OPTIONS } from "@/lib/constants";
import { CountrySelectField } from "@/components/forms/CountrySelectField";
import FooterLink from "@/components/forms/FooterLink";
import { signUpWithEmail } from "@/lib/actions/auth.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import OpenDevSocietyBranding from "@/components/OpenDevSocietyBranding";
import SocialAuthButtons from "@/components/forms/SocialAuthButtons";
import React from "react";
import { zh } from "@/lib/i18n/zh-Hant";

const SignUp = () => {
    const router = useRouter()
    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<SignUpFormData>({
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            country: 'IN',
            investmentGoals: 'Growth',
            riskTolerance: 'Medium',
            preferredIndustry: 'Technology'
        },
        mode: 'onBlur'
    },);

    const passwordValue = watch('password');

    const onSubmit = async (data: SignUpFormData) => {
        try {
            const result = await signUpWithEmail(data);
            if (result.success) {
                router.push('/dashboard');
                return;
            }
            toast.error(zh.auth.signUpFailed, {
                description: result.error ?? zh.auth.signUpError,
            });
        } catch (e) {
            console.error(e);
            toast.error(zh.auth.signUpFailed, {
                description: e instanceof Error ? e.message : zh.auth.signUpError
            })
        }
    }

    return (
        <>
            <h1 className="form-title mb-2">{zh.auth.createTitle}</h1>
            <p className="mb-8 text-faint">{zh.auth.createSub}</p>

            <SocialAuthButtons />

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
                <section className="flex flex-col gap-4" aria-label={zh.auth.accountSection}>
                    <InputField
                        name="fullName"
                        label={zh.auth.fullName}
                        placeholder={zh.auth.fullNamePlaceholder}
                        register={register}
                        error={errors.fullName}
                        validation={{ required: zh.auth.fullNameRequired, minLength: { value: 2, message: zh.auth.profileNameShort } }}
                    />
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
                    <div className="flex flex-col gap-2">
                        <InputField
                            name="password"
                            label={zh.auth.password}
                            placeholder={zh.auth.passwordHint}
                            type="password"
                            register={register}
                            error={errors.password}
                            validation={PASSWORD_VALIDATION}
                        />
                        <PasswordRequirements password={passwordValue ?? ''} />
                    </div>
                </section>

                <section className="flex flex-col gap-5 border-t border-line pt-6" aria-labelledby="personalize">
                    <div>
                        <p id="personalize" className="kicker text-brand-ink">{zh.auth.personalize}</p>
                        <p className="mt-1 text-[13px] text-faint">{zh.auth.personalizeHint}</p>
                    </div>
                    <CountrySelectField
                        name="country"
                        label={zh.auth.country}
                        control={control}
                        error={errors.country}
                        required
                    />
                    <ChoiceChips name="investmentGoals" label={zh.auth.goal} options={INVESTMENT_GOALS} control={control} />
                    <ChoiceChips name="riskTolerance" label={zh.auth.risk} options={RISK_TOLERANCE_OPTIONS} control={control} />
                    <ChoiceChips name="preferredIndustry" label={zh.auth.industry} options={PREFERRED_INDUSTRIES} control={control} />
                </section>

                <div className="flex flex-col gap-4">
                    <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full">
                        {isSubmitting ? zh.auth.creating : zh.auth.create}
                    </Button>
                    <FooterLink text={zh.auth.haveAccount} linkText={zh.auth.signIn} href="/sign-in" />
                </div>

                <OpenDevSocietyBranding outerClassName="flex justify-center" />
            </form>
        </>
    )
}
export default SignUp;
