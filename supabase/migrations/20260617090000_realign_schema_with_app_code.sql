-- ================================================================
-- TripSync — schema realignment
-- แก้ schema ให้ตรงกับ field names และ business logic ที่ code ใช้จริง:
--   - trips.title -> name, เพิ่ม destination/startsAt/endsAt, created_by nullable
--   - trip_members.role -> 'leader' | 'member', display_name nullable
--   - survey_questions.type -> 'date_range' | 'multiple_choice' | 'budget_range' | 'text'
--   - survey_responses: เพิ่ม trip_id, เปลี่ยน unique key ให้ upsert ได้ถูกต้อง
-- ================================================================

-- ----------------------------------------------------------------
-- trips: title -> name, เพิ่มคอลัมน์ที่ types/trip.ts ต้องการ
-- ----------------------------------------------------------------
alter table public.trips rename column title to name;
alter table public.trips alter column created_by drop not null;
alter table public.trips add column if not exists destination text;
alter table public.trips add column if not exists "startsAt" date;
alter table public.trips add column if not exists "endsAt" date;

-- ----------------------------------------------------------------
-- trip_members: role ใช้ leader/member ตามที่ TripMember type กำหนด,
-- display_name อนุญาตให้เป็น null ชั่วคราว (UI อาจส่ง null ก่อนเติมชื่อ)
-- ----------------------------------------------------------------
alter table public.trip_members drop constraint if exists trip_members_role_check;
alter table public.trip_members
  add constraint trip_members_role_check check (role in ('leader', 'member'));
alter table public.trip_members alter column display_name drop not null;

-- มี trip เก่าที่สร้างด้วย role='owner' มาก่อนหน้านี้ไหม ให้ map เป็น leader
update public.trip_members set role = 'leader' where role = 'owner';
update public.trip_members set role = 'member' where role = 'admin';

-- ----------------------------------------------------------------
-- survey_questions: type ต้องตรงกับ SurveyQuestionType ใน TS
-- ----------------------------------------------------------------
alter table public.survey_questions drop constraint if exists survey_questions_type_check;
alter table public.survey_questions
  add constraint survey_questions_type_check
  check (type in ('date_range', 'multiple_choice', 'budget_range', 'text'));

-- ----------------------------------------------------------------
-- survey_responses: เพิ่ม trip_id (denormalized, เติมจาก survey_questions
-- ตอน insert ถ้า client ไม่ส่งมา) และเปลี่ยน unique key เป็น upsert-friendly
-- ----------------------------------------------------------------
alter table public.survey_responses add column if not exists trip_id uuid;

update public.survey_responses sr
set trip_id = sq.trip_id
from public.survey_questions sq
where sr.question_id = sq.id and sr.trip_id is null;

alter table public.survey_responses
  add constraint survey_responses_trip_id_fkey
  foreign key (trip_id) references public.trips(id) on delete cascade;

alter table public.survey_responses alter column trip_id set not null;

-- เก็บ unique (question_id, member_id) ไว้เหมือนเดิม — submitResponses()
-- ควร upsert ด้วย onConflict นี้แทนการ insert ตรงๆ เพื่อให้ตอบซ้ำได้
-- (ดูการแก้ไขใน lib/survey.ts คู่กับ migration นี้)

-- Auto-fill trip_id จาก question_id ถ้า client ไม่ส่งมา (กันพลาดในอนาคต)
create or replace function public.set_survey_response_trip_id()
returns trigger
language plpgsql
as $$
begin
  if new.trip_id is null then
    select trip_id into new.trip_id from public.survey_questions where id = new.question_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_survey_response_trip_id_before_insert on public.survey_responses;
create trigger set_survey_response_trip_id_before_insert
  before insert on public.survey_responses
  for each row execute function public.set_survey_response_trip_id();
