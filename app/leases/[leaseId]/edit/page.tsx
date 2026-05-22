"use client";

import React, {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { supabase } from "../../../../lib/supabase";

export default function EditLeasePage({
  params,
}: {
  params: Promise<{ leaseId: string }>;
}) {

  const resolvedParams =
    React.use(params);

  const router = useRouter();

  const [leaseId, setLeaseId] =
    useState("");

  const [tenantName, setTenantName] =
    useState("");

  const [propertyName, setPropertyName] =
    useState("");

  const [
    monthlyRental,
    setMonthlyRental,
  ] = useState("");

  const [
    renewalStage,
    setRenewalStage,
  ] = useState("");

  const [
    vacancyRisk,
    setVacancyRisk,
  ] = useState("");

  const [
    companyRegistration,
    setCompanyRegistration,
  ] = useState("");

  const [vatNumber, setVatNumber] =
    useState("");

  const [
    commencementDate,
    setCommencementDate,
  ] = useState("");

  const [expiryDate, setExpiryDate] =
    useState("");

  const [
    escalationPercent,
    setEscalationPercent,
  ] = useState("");

  const [
    depositAmount,
    setDepositAmount,
  ] = useState("");

  useEffect(() => {

    async function fetchLease() {

      const { data } = await supabase
        .from("leases")
        .select("*")
        .eq(
          "lease_id",
          resolvedParams.leaseId
        )
        .single();

      if (data) {

        setLeaseId(data.lease_id || "");

        setTenantName(
          data.tenant_name || ""
        );

        setPropertyName(
          data.property_name || ""
        );

        setMonthlyRental(
          data.monthly_rental || ""
        );

        setRenewalStage(
          data.renewal_stage || ""
        );

        setVacancyRisk(
          data.vacancy_risk || ""
        );

        setCompanyRegistration(
          data.company_registration || ""
        );

        setVatNumber(
          data.vat_number || ""
        );

        setCommencementDate(
          data.commencement_date || ""
        );

        setExpiryDate(
          data.expiry_date || ""
        );

        setEscalationPercent(
          data.escalation_percent || ""
        );

        setDepositAmount(
          data.deposit_amount || ""
        );
      }
    }

    fetchLease();

  }, [resolvedParams.leaseId]);

  async function handleUpdateLease() {

    const { error } = await supabase
      .from("leases")
      .update({

        tenant_name: tenantName,

        property_name: propertyName,

        monthly_rental:
  monthlyRental || null,

        renewal_stage: renewalStage,

        vacancy_risk: vacancyRisk,

        company_registration:
          companyRegistration,

        vat_number: vatNumber,

        commencement_date:
          commencementDate,

        expiry_date: expiryDate,

        escalation_percent:
  escalationPercent || null,

        deposit_amount:
  depositAmount || null,
      })
      .eq(
        "lease_id",
        resolvedParams.leaseId
      );

    if (error) {

  console.error(error);

  alert(error.message);

} else {

      alert("Lease updated successfully");

      router.push("/leases");
    }
  }

  return (

    <main className="min-h-screen bg-gray-100 p-10 text-black">

      <h1 className="text-4xl font-bold mb-8">
        Edit Lease
      </h1>

      <div className="bg-white rounded-xl shadow p-8 max-w-5xl">

        <div className="grid grid-cols-2 gap-6">

          <div>

            <label className="block mb-2 font-semibold">
              Lease ID
            </label>

            <input
              type="text"
              value={leaseId}
              disabled
              className="w-full border rounded-lg p-3 bg-gray-100"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Tenant Name
            </label>

            <input
              type="text"
              value={tenantName}
              onChange={(e) =>
                setTenantName(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Property Name
            </label>

            <input
              type="text"
              value={propertyName}
              onChange={(e) =>
                setPropertyName(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Monthly Rental
            </label>

            <input
              type="number"
              value={monthlyRental}
              onChange={(e) =>
                setMonthlyRental(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Renewal Stage
            </label>

            <input
              type="text"
              value={renewalStage}
              onChange={(e) =>
                setRenewalStage(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Vacancy Risk
            </label>

            <input
              type="text"
              value={vacancyRisk}
              onChange={(e) =>
                setVacancyRisk(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Company Registration
            </label>

            <input
              type="text"
              value={companyRegistration}
              onChange={(e) =>
                setCompanyRegistration(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              VAT Number
            </label>

            <input
              type="text"
              value={vatNumber}
              onChange={(e) =>
                setVatNumber(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Commencement Date
            </label>

            <input
              type="date"
              value={commencementDate}
              onChange={(e) =>
                setCommencementDate(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Expiry Date
            </label>

            <input
              type="date"
              value={expiryDate}
              onChange={(e) =>
                setExpiryDate(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Escalation %
            </label>

            <input
              type="number"
              value={escalationPercent}
              onChange={(e) =>
                setEscalationPercent(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

          <div>

            <label className="block mb-2 font-semibold">
              Deposit Amount
            </label>

            <input
              type="number"
              value={depositAmount}
              onChange={(e) =>
                setDepositAmount(
                  e.target.value
                )
              }
              className="w-full border rounded-lg p-3"
            />

          </div>

        </div>

        <button
          onClick={handleUpdateLease}
          className="mt-8 bg-black text-white px-6 py-3 rounded-lg"
        >
          Update Lease
        </button>

      </div>

    </main>
  );
}