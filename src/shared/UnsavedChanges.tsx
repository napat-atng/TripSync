import { useCallback, useEffect, useId } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { Button, Group, Modal, Text } from "@mantine/core";
import { useDirtyForms } from "../app/DirtyFormsProvider";

export function UnsavedChanges({ dirty }: { dirty: boolean }) {
  const id = useId();
  const { register } = useDirtyForms();
  useEffect(() => { register(id, dirty); return () => register(id, false); }, [id, dirty, register]);
  const blocker = useBlocker(dirty);
  useBeforeUnload(useCallback(event => {
    if (dirty) { event.preventDefault(); event.returnValue = ""; }
  }, [dirty]));
  return <Modal opened={blocker.state === "blocked"} onClose={() => blocker.reset?.()} title="ยังไม่ได้บันทึกการเปลี่ยนแปลง" centered>
    <Text>กลับไปแก้ไขต่อ หรือออกจากหน้านี้โดยไม่บันทึก?</Text>
    <Group mt="lg" justify="flex-end"><Button variant="default" onClick={() => blocker.reset?.()}>แก้ไขต่อ</Button><Button color="red" onClick={() => blocker.proceed?.()}>ออกโดยไม่บันทึก</Button></Group>
  </Modal>;
}
