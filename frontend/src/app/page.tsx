"use client";
import type { WithAuthenticatorProps } from "@aws-amplify/ui-react";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import {
    AppLayout,
    BreadcrumbGroup,
    Button,
    Container,
    ContentLayout,
    Grid,
    Header,
    Spinner,
    SplitPanel,
    Textarea,
    TopNavigation,
} from "@cloudscape-design/components";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/api";
import * as React from "react";
import { v4 as uuidv4 } from "uuid";
import { currentConfig } from "../../aws-config";
import { answerUpdate } from "@/graphql/subscriptions";
import { AnswerChunk } from "@/API";
import { newPrompt } from "@/graphql/mutations";

Amplify.configure(currentConfig);

interface Message {
    text: string,
    type: "PROMPT" | "RESPONSE"
}


function Home({ signOut, user }: WithAuthenticatorProps) {

    const [inputPrompt, setInputPrompt] = React.useState("");
    const [responseLoading, setResponseLoading] = React.useState(false);
    const [invalidPrompt, setInvalidPrompt] = React.useState(false);
    const [allMessages, setAllMessages] = React.useState<Array<Message>>(Array);
    const client = generateClient();
    const answerId = user?.userId + "." + uuidv4();

    function validateInput() {
        if (inputPrompt.length < 10) {
            setInvalidPrompt(true);
            return false;
        } else {
            return true;
        }
    }

    async function processPrompt() {
        setResponseLoading(true);

        let responseMessage: Message = { text: "", type: "RESPONSE" }

        const sub = client
            .graphql({ query: answerUpdate, variables: { answerId: answerId } })
            .subscribe({
                next: ({ data }) => {
                    const currentChunk: AnswerChunk = data.answerUpdate
                    if (currentChunk.answerStatus == 'DONE') {
                        sub.unsubscribe()
                        return
                    }
                    if (!responseMessage.text) {
                        setResponseLoading(false)
                        responseMessage.text = currentChunk.answerChunk
                        setAllMessages(messages => [...messages, responseMessage])
                    } else {
                        let messages = [...allMessages]
                        messages[messages.length] = responseMessage
                        setAllMessages(messages)
                    }
                },
                error: (error) => console.warn(error)
            });

        const inputMessage: Message = {
            text: inputPrompt,
            type: "PROMPT"
        }
        setAllMessages(messages => [...messages, inputMessage])

        await client.graphql({
            authMode: "userPool",
            query: newPrompt,
            variables: {
                answerId,
                answerStatus: "starting",
                prompt: inputPrompt,
            },
        });
    }


    return (
        <main>
            <TopNavigation
                identity={{
                    href: "#",
                    title: "Multi-tenant AI Assistant Demo",
                    logo: {
                        src: "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIj8+Cjxzdmcgd2lkdGg9IjY0MCIgaGVpZ2h0PSI0ODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPgogPCEtLSBDcmVhdGVkIHdpdGggU1ZHLWVkaXQgLSBodHRwczovL2dpdGh1Yi5jb20vU1ZHLUVkaXQvc3ZnZWRpdC0tPgogPGRlZnM+CiAgPHN5bWJvbCBlbmFibGUtYmFja2dyb3VuZD0ibmV3IDAgMCAzMDQgMTgyIiBpZD0ic3ZnXzIiIHZlcnNpb249IjEuMSIgdmlld0JveD0iMCAwIDMwNCAxODIiIHg9IjBweCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeT0iMHB4Ij4KICAgPHN0eWxlIHR5cGU9InRleHQvY3NzIj4uc3Qwe2ZpbGw6I0ZGRkZGRjt9Cgkuc3Qxe2ZpbGwtcnVsZTpldmVub2RkO2NsaXAtcnVsZTpldmVub2RkO2ZpbGw6I0ZGOTkwMDt9PC9zdHlsZT4KICAgPGc+CiAgICA8cGF0aCBjbGFzcz0ic3QwIiBkPSJtODYuNCw2Ni40YzAsMy43IDAuNCw2LjcgMS4xLDguOWMwLjgsMi4yIDEuOCw0LjYgMy4yLDcuMmMwLjUsMC44IDAuNywxLjYgMC43LDIuM2MwLDEgLTAuNiwyIC0xLjksM2wtNi4zLDQuMmMtMC45LDAuNiAtMS44LDAuOSAtMi42LDAuOWMtMSwwIC0yLC0wLjUgLTMsLTEuNGMtMS40LC0xLjUgLTIuNiwtMy4xIC0zLjYsLTQuN2MtMSwtMS43IC0yLC0zLjYgLTMuMSwtNS45Yy03LjgsOS4yIC0xNy42LDEzLjggLTI5LjQsMTMuOGMtOC40LDAgLTE1LjEsLTIuNCAtMjAsLTcuMmMtNC45LC00LjggLTcuNCwtMTEuMiAtNy40LC0xOS4yYzAsLTguNSAzLC0xNS40IDkuMSwtMjAuNmM2LjEsLTUuMiAxNC4yLC03LjggMjQuNSwtNy44YzMuNCwwIDYuOSwwLjMgMTAuNiwwLjhjMy43LDAuNSA3LjUsMS4zIDExLjUsMi4ybDAsLTcuM2MwLC03LjYgLTEuNiwtMTIuOSAtNC43LC0xNmMtMy4yLC0zLjEgLTguNiwtNC42IC0xNi4zLC00LjZjLTMuNSwwIC03LjEsMC40IC0xMC44LDEuM2MtMy43LDAuOSAtNy4zLDIgLTEwLjgsMy40Yy0xLjYsMC43IC0yLjgsMS4xIC0zLjUsMS4zYy0wLjcsMC4yIC0xLjIsMC4zIC0xLjYsMC4zYy0xLjQsMCAtMi4xLC0xIC0yLjEsLTMuMWwwLC00LjljMCwtMS42IDAuMiwtMi44IDAuNywtMy41YzAuNSwtMC43IDEuNCwtMS40IDIuOCwtMi4xYzMuNSwtMS44IDcuNywtMy4zIDEyLjYsLTQuNWM0LjksLTEuMyAxMC4xLC0xLjkgMTUuNiwtMS45YzExLjksMCAyMC42LDIuNyAyNi4yLDguMWM1LjUsNS40IDguMywxMy42IDguMywyNC42bDAsMzIuNGwwLjIsMHptLTQwLjYsMTUuMmMzLjMsMCA2LjcsLTAuNiAxMC4zLC0xLjhjMy42LC0xLjIgNi44LC0zLjQgOS41LC02LjRjMS42LC0xLjkgMi44LC00IDMuNCwtNi40YzAuNiwtMi40IDEsLTUuMyAxLC04LjdsMCwtNC4yYy0yLjksLTAuNyAtNiwtMS4zIC05LjIsLTEuN2MtMy4yLC0wLjQgLTYuMywtMC42IC05LjQsLTAuNmMtNi43LDAgLTExLjYsMS4zIC0xNC45LDRjLTMuMywyLjcgLTQuOSw2LjUgLTQuOSwxMS41YzAsNC43IDEuMiw4LjIgMy43LDEwLjZjMi40LDIuNSA1LjksMy43IDEwLjUsMy43em04MC4zLDEwLjhjLTEuOCwwIC0zLC0wLjMgLTMuOCwtMWMtMC44LC0wLjYgLTEuNSwtMiAtMi4xLC0zLjlsLTIzLjUsLTc3LjNjLTAuNiwtMiAtMC45LC0zLjMgLTAuOSwtNGMwLC0xLjYgMC44LC0yLjUgMi40LC0yLjVsOS44LDBjMS45LDAgMy4yLDAuMyAzLjksMWMwLjgsMC42IDEuNCwyIDIsMy45bDE2LjgsNjYuMmwxNS42LC02Ni4yYzAuNSwtMiAxLjEsLTMuMyAxLjksLTMuOWMwLjgsLTAuNiAyLjIsLTEgNCwtMWw4LDBjMS45LDAgMy4yLDAuMyA0LDFjMC44LDAuNiAxLjUsMiAxLjksMy45bDE1LjgsNjdsMTcuMywtNjdjMC42LC0yIDEuMywtMy4zIDIsLTMuOWMwLjgsLTAuNiAyLjEsLTEgMy45LC0xbDkuMywwYzEuNiwwIDIuNSwwLjggMi41LDIuNWMwLDAuNSAtMC4xLDEgLTAuMiwxLjZjLTAuMSwwLjYgLTAuMywxLjQgLTAuNywyLjVsLTI0LjEsNzcuM2MtMC42LDIgLTEuMywzLjMgLTIuMSwzLjljLTAuOCwwLjYgLTIuMSwxIC0zLjgsMWwtOC42LDBjLTEuOSwwIC0zLjIsLTAuMyAtNCwtMWMtMC44LC0wLjcgLTEuNSwtMiAtMS45LC00bC0xNS41LC02NC41bC0xNS40LDY0LjRjLTAuNSwyIC0xLjEsMy4zIC0xLjksNGMtMC44LDAuNyAtMi4yLDEgLTQsMWwtOC42LDB6bTEyOC41LDIuN2MtNS4yLDAgLTEwLjQsLTAuNiAtMTUuNCwtMS44Yy01LC0xLjIgLTguOSwtMi41IC0xMS41LC00Yy0xLjYsLTAuOSAtMi43LC0xLjkgLTMuMSwtMi44Yy0wLjQsLTAuOSAtMC42LC0xLjkgLTAuNiwtMi44bDAsLTUuMWMwLC0yLjEgMC44LC0zLjEgMi4zLC0zLjFjMC42LDAgMS4yLDAuMSAxLjgsMC4zYzAuNiwwLjIgMS41LDAuNiAyLjUsMWMzLjQsMS41IDcuMSwyLjcgMTEsMy41YzQsMC44IDcuOSwxLjIgMTEuOSwxLjJjNi4zLDAgMTEuMiwtMS4xIDE0LjYsLTMuM2MzLjQsLTIuMiA1LjIsLTUuNCA1LjIsLTkuNWMwLC0yLjggLTAuOSwtNS4xIC0yLjcsLTdjLTEuOCwtMS45IC01LjIsLTMuNiAtMTAuMSwtNS4ybC0xNC41LC00LjVjLTcuMywtMi4zIC0xMi43LC01LjcgLTE2LC0xMC4yYy0zLjMsLTQuNCAtNSwtOS4zIC01LC0xNC41YzAsLTQuMiAwLjksLTcuOSAyLjcsLTExLjFjMS44LC0zLjIgNC4yLC02IDcuMiwtOC4yYzMsLTIuMyA2LjQsLTQgMTAuNCwtNS4yYzQsLTEuMiA4LjIsLTEuNyAxMi42LC0xLjdjMi4yLDAgNC41LDAuMSA2LjcsMC40YzIuMywwLjMgNC40LDAuNyA2LjUsMS4xYzIsMC41IDMuOSwxIDUuNywxLjZjMS44LDAuNiAzLjIsMS4yIDQuMiwxLjhjMS40LDAuOCAyLjQsMS42IDMsMi41YzAuNiwwLjggMC45LDEuOSAwLjksMy4zbDAsNC43YzAsMi4xIC0wLjgsMy4yIC0yLjMsMy4yYy0wLjgsMCAtMi4xLC0wLjQgLTMuOCwtMS4yYy01LjcsLTIuNiAtMTIuMSwtMy45IC0xOS4yLC0zLjljLTUuNywwIC0xMC4yLDAuOSAtMTMuMywyLjhjLTMuMSwxLjkgLTQuNyw0LjggLTQuNyw4LjljMCwyLjggMSw1LjIgMyw3LjFjMiwxLjkgNS43LDMuOCAxMSw1LjVsMTQuMiw0LjVjNy4yLDIuMyAxMi40LDUuNSAxNS41LDkuNmMzLjEsNC4xIDQuNiw4LjggNC42LDE0YzAsNC4zIC0wLjksOC4yIC0yLjYsMTEuNmMtMS44LDMuNCAtNC4yLDYuNCAtNy4zLDguOGMtMy4xLDIuNSAtNi44LDQuMyAtMTEuMSw1LjZjLTQuNSwxLjQgLTkuMiwyLjEgLTE0LjMsMi4xeiIvPgogICAgPGc+CiAgICAgPHBhdGggY2xhc3M9InN0MSIgZD0ibTI3My41LDE0My43Yy0zMi45LDI0LjMgLTgwLjcsMzcuMiAtMTIxLjgsMzcuMmMtNTcuNiwwIC0xMDkuNSwtMjEuMyAtMTQ4LjcsLTU2LjdjLTMuMSwtMi44IC0wLjMsLTYuNiAzLjQsLTQuNGM0Mi40LDI0LjYgOTQuNywzOS41IDE0OC44LDM5LjVjMzYuNSwwIDc2LjYsLTcuNiAxMTMuNSwtMjMuMmM1LjUsLTIuNSAxMC4yLDMuNiA0LjgsNy42eiIvPgogICAgIDxwYXRoIGNsYXNzPSJzdDEiIGQ9Im0yODcuMiwxMjguMWMtNC4yLC01LjQgLTI3LjgsLTIuNiAtMzguNSwtMS4zYy0zLjIsMC40IC0zLjcsLTIuNCAtMC44LC00LjVjMTguOCwtMTMuMiA0OS43LC05LjQgNTMuMywtNWMzLjYsNC41IC0xLDM1LjQgLTE4LjYsNTAuMmMtMi43LDIuMyAtNS4zLDEuMSAtNC4xLC0xLjljNCwtOS45IDEyLjksLTMyLjIgOC43LC0zNy41eiIvPgogICAgPC9nPgogICA8L2c+CiAgPC9zeW1ib2w+CiA8L2RlZnM+CiA8ZyBjbGFzcz0ibGF5ZXIiPgogIDx0aXRsZT5MYXllciAxPC90aXRsZT4KICA8dXNlIGlkPSJzdmdfMyIgdHJhbnNmb3JtPSJtYXRyaXgoMC45MTExMzEgMCAwIDAuOTExMTMxIC0xMzcuNDA0IC02Ny44MDgxKSIgeD0iMTgxLjkzIiB4bGluazpocmVmPSIjc3ZnXzIiIHk9IjgyLjMxIi8+CiA8L2c+Cjwvc3ZnPg==",
                        alt: "AWS",
                    },
                }}
                utilities={[
                    {
                        type: "button",
                        text: "Logout",
                        external: false,
                        onClick: () => signOut?.(),
                    },
                    {
                        type: "menu-dropdown",
                        text: user?.username,
                        description: "email@example.com",
                        iconName: "user-profile",
                        items: [
                            { id: "profile", text: "Profile" },
                            { id: "preferences", text: "Preferences" },
                            { id: "security", text: "Security" },
                        ],
                    },
                ]}
            />
            <AppLayout
                contentType="table"
                toolsHide={true}
                breadcrumbs={
                    <BreadcrumbGroup
                        items={[
                            { text: "Home", href: "#" },
                            { text: "Multi-tenant AI Assistant", href: "#" },
                        ]}
                        expandAriaLabel="Show path"
                        ariaLabel="Breadcrumbs"
                    />
                }
                content={
                    <>
                        <ContentLayout
                            header={<Header variant="h1">Multi-tenant AI Assistant</Header>}
                        >
                            {
                                allMessages.map((message) => {
                                    if (message.type === "PROMPT") {
                                        return (
                                            <Grid
                                                gridDefinition={[{ colspan: 4 }, { colspan: 8 }]}
                                                key={Math.random() * 1000}
                                            >
                                                <div />
                                                <Container
                                                    data-background="prompt"
                                                >
                                                    {message.text}
                                                </Container>
                                            </Grid>
                                        )
                                    } else {
                                        return (
                                            <Grid
                                                gridDefinition={[{ colspan: 8 }, { colspan: 4 }]}
                                                key={Math.random() * 1000}
                                            >
                                                <Container
                                                    data-background="response"
                                                >
                                                    <div style={{ whiteSpace: "pre-line" }}>
                                                        {message.text}
                                                    </div>
                                                </Container>
                                                <div />
                                            </Grid>
                                        )
                                    }
                                }).concat([responseLoading ?
                                    <Grid
                                        gridDefinition={[{ colspan: 8 }, { colspan: 4 }]}
                                        key={Math.random() * 1000}
                                    >
                                        <Container
                                            data-background="response"
                                        >
                                            <Spinner />
                                        </Container>
                                        <div />
                                    </Grid> : <></>
                                ])

                            }


                        </ContentLayout>
                    </>
                }
                navigationHide={true}
                navigationOpen={false}
                splitPanelOpen={true}
                splitPanel={
                    <SplitPanel header="Enter your Prompt" hidePreferencesButton={true}>
                        <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }]}>
                            <Textarea
                                onChange={({ detail }) => setInputPrompt(detail.value)}
                                value={inputPrompt}
                                placeholder="This is a placeholder"
                                disabled={responseLoading}
                                invalid={invalidPrompt}
                            />
                            <Button
                                variant="primary"
                                onClick={() => {
                                    const valid = validateInput();
                                    if (valid) {
                                        processPrompt();
                                    }
                                }}
                                disabled={responseLoading}
                            >
                                Send Prompt
                            </Button>
                        </Grid>
                    </SplitPanel>
                }
            />
        </main>
    );
}

export default withAuthenticator(Home);
