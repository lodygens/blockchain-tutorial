This is a tutorial to see a first smartcontract in action


# Docker installation

## Software installation

We need to install the OpenStack client by clicking next command:

{{ exec default: apt-get update && apt-get upgrade && apt-get install -y python-dev python-pip && pip install python-openstackclient }}

## TERENA certificate

LAL infrastructure uses TERENA certificates. This may have some impacts with OpenStack on server certification.

You can install the certificate by clicking next command:

{{ exec default: wget https://openstack.lal.in2p3.fr/files/2016/02/terena.pem -O terena.pem }}

## Client configuration

You must create a text file containing your credentials as well a the project you belong to.

### Create new config file

First open a text file by clicking next command:

{{ exec default: vi cloud_config.sh }}

In the terminal, hit 'i' to start inserting the following text in vi.
Finally copy/paste in the default terminal (right click on the terminal to open a contextual menu and select paste).

export OS_USERNAME=   
export OS_PASSWORD=   
export OS_TENANT_NAME=   
export OS_PROJECT_NAME=   
export OS_AUTH_URL=https://keystone.lal.in2p3.fr:5000/v3   
export OS_IDENTITY_API_VERSION=3   
export OS_CACERT=$HOME/terena.pem   
export OS_USER_DOMAIN_NAME=   
export OS_PROJECT_DOMAIN_NAME=   

### Edit config file

Insert your credential, domain and project name.

# OpenStack client usage
You have to source your cloud_config.sh script by clicking next command:

{{ exec default: source cloud_config.sh }}

Then you can start using the platform. Click on next command as example:

{{ exec default: openstack server list }}
